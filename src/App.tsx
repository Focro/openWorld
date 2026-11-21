import { createAppearanceState, describeAppearance, isHaircutDescriptionAllowed, isNonInheritedAppearanceDescriptionAllowed } from "./engine/appearance";
import { useEffect, useMemo, useRef, useState } from "react";
import { readAutosave, writeAutosave, type AutosaveInfo } from "./ui/autosave";
import type { FormEvent } from "react";
import { applyAction } from "./engine/rules";
import { parseAction } from "./engine/parse";
import { resolveWithAi } from "./engine/ai";
import { UnlockedKeySession, loadVaultRecord, saveVaultRecord } from "./ai/keyVault";
import type { Session } from "@supabase/supabase-js";
import { AUTO_SLOT, GRAVEYARD_SLOT, GRAVEYARD_WORLD, getCloudSave, deleteCloudKeys, fetchProfile, getCloud, getCloudKey, putCloudKey, putCloudSave, reportChildSafetyStrike, saveAdultMode, saveBirthDate, type Profile } from "./cloud/account";
import { AccountPanel, SignInForm } from "./ui/AccountPanel";
import { ProxyActionProposer, isAiProviderId, type AiProviderId } from "./ai/proxyClient";
import { AiSettings } from "./ui/AiSettings";
import { understandFreeText } from "./engine/intent";
import { ageFromBirthDate, isChildSafetyViolation, localSafetyStore, registerViolation, type SafetyStore } from "./engine/safety";
import { applyScene, buildSceneContext, buildSceneEnvelope, coerceScene, hasListeners, isGameLanguage, type GameLanguage, type SceneEvent, isNarrationPerson, type NarrationPerson } from "./engine/speech";
import { CachingProposer } from "./ai/intentCache";
import { loadUsage, recordUsage } from "./ai/usage";
import { createInitialState } from "./engine/world";
import { importGamePayload } from "./engine/save";
import { DEFAULT_WORLD_ID, WORLDS, getWorldEntry, migrateStateForWorld, resolveWorldForState } from "./worlds/registry";
import { startVeloriaCampaign } from "./worlds/veloria/campaign";
import { NEWBORN_ORIGINS, NEWBORN_ORIGIN_LABELS } from "./worlds/veloria/birthFamily";
import { LifePanel } from "./ui/LifePanel";
import { NewLifeWizard, draftForOrigin } from "./ui/NewLifeWizard";
import { BIRTH_ORIGINS, birthOrigin } from "./worlds/veloria/birthOrigins";
import { capabilities, formatAge, INFANT_ACT_LABELS, NEUTRAL_TEMPERAMENT, type InfantActId } from "./engine/development";
import { dayOfYear, formatClock, yearKLOf } from "./engine/time";
import { describeAttitude } from "./engine/relations";
import type { MemoryEntry, GameState } from "./engine/types";
import {
  availableProfessions, availableScenarios, availableStatuses,
  resolveVeloriaStart
} from "./worlds/veloria/character";
import type { VeloriaCharacterDraft, VeloriaOriginId, VeloriaStatusId, VeloriaProfessionId, VeloriaFamilyState, VeloriaStartScenario } from "./worlds/veloria/character";
import { VELORIA_ORIGIN_LABELS } from "./worlds/veloria/lore";
import { documentedAcknowledgedBastards, documentedDynasticOptions, validateFamilyRecord } from "./worlds/veloria/family";
import { generateVeloriaFamily } from "./worlds/veloria/familyGeneration";
import { getChildAppearanceOptions, validateChildAppearance } from "./worlds/veloria/heritage";
import { FAITHS } from "./worlds/veloria/faiths";
import { WORLD_DIFFICULTIES, type WorldDifficultyId } from "./worlds/veloria/difficulty";
import { COUNTRIES, REGIONS, MAP_NODES, ROUTES, COUNTRY_SHAPES, MAP_WATERS } from "./worlds/veloria/atlas";
import { MAP_IMAGE, knownSettlementIds, mapHitAt, type MapHit } from "./worlds/veloria/mapLayer";
import { knownPeople, ageText } from "./engine/acquaintances";
import { DEATH_IS_FINAL_MESSAGE, buryIfDead, loadBlockedByDeath, loadGraveyard, mergeGraveyards, newLifeId, saveGraveyard, type GraveRecord } from "./engine/permadeath";
import { advanceVeloriaJourney, beginVeloriaJourney, findVeloriaRoute } from "./worlds/veloria/travel";
import "./styles.css";

function familyMemberLabel(member: import("./engine/types").NpcDef): string {
  if (member.id.endsWith("-grandmother")) return "бабушка";
  if (member.id.endsWith("-wet-nurse")) return "кормилица";
  if (member.id.endsWith("-sister")) return "храмовая сестра, опекун";
  if (member.id.includes("-sibling-")) return "старший брат или сестра";
  if (member.caregiving?.role === "mother") return "мать";
  if (member.caregiving?.role === "father") return "отец";
  return member.familyRole === "guardian" ? "опекун" : "биологический родитель";
}

function readPref(key: string, fallback: string): string { try { return globalThis.localStorage?.getItem(key) ?? fallback; } catch { return fallback; } }
function writePref(key: string, value: string): void { try { globalThis.localStorage?.setItem(key, value); } catch { /* хранилище недоступно */ } }

type Tab = "ИГРА" | "ДОРОГА" | "МИР" | "ПЕРСОНАЖ" | "ПАМЯТЬ" | "СИСТЕМА";
const TABS: Tab[] = ["ИГРА", "ДОРОГА", "МИР", "ПЕРСОНАЖ", "ПАМЯТЬ", "СИСТЕМА"];
const ATTRIBUTE_NAMES = ["Сила", "Выносливость", "Ловкость", "Интеллект", "Восприятие", "Харизма", "Воля"] as const;
const DEFAULT_ATTRIBUTES = { Сила: 15, Выносливость: 15, Ловкость: 15, Интеллект: 15, Восприятие: 15, Харизма: 10, Воля: 15 };
const ORIGINS = Object.keys(VELORIA_ORIGIN_LABELS) as VeloriaOriginId[];
const STATUS_LABELS: Record<VeloriaStatusId, string> = { noble:"Дворянский", "guild-free":"Свободный горожанин / гильдейский", "rural-free":"Свободный сельский", temple:"Храмовый", marginal:"Низший / неустойчивый статус", serving:"Служилый" };
const PROFESSION_LABELS: Record<VeloriaProfessionId, string> = { squire:"Оруженосец", scribe:"Писец", guard:"Стражник", soldier:"Солдат", merchant:"Торговец", craftsman:"Ремесленник", apprentice:"Подмастерье", farmer:"Земледелец", "healer-assistant":"Помощник целителя", carter:"Возчик", laborer:"Подёнщик", none:"Без постоянной профессии" };
const FAMILY_LABELS: Record<VeloriaFamilyState, string> = { together:"Семья рядом", distant:"Семья живёт далеко", lost:"Семья пропала / связь потеряна", unknown:"Происхождение неизвестно", "chosen-family":"Опекуны / выбранная семья" };
const SCENARIO_LABELS: Record<VeloriaStartScenario, string> = { ordinary:"Обычное начало", journey:"Недавно прибыл в Ровен", "debt-flight":"Бегство от долга", exile:"Изгнание", "captivity-escape":"Побег из плена" };
const initialDraft: VeloriaCharacterDraft = { name:"Путник", age:22, originId:"wanderer", statusId:"marginal", professionId:"none", familyState:"together", startScenarioId:"ordinary", biography:"", heightCm:170, weightKg:68, build:"Среднее", hair:"", hairstyle:"", eyes:"", appearance:"", personality:"", education:"", faithId:"sevenfold", skills:"", familyNotes:"", attributes:DEFAULT_ATTRIBUTES };
function createFamilySeed(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `family-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function ArdanMap({ current, destination, route, known }: { current: string; destination: string; route: Array<{from:string;to:string}>; known: Set<string> }) {
  // Тап по карте: название места, края или державы. Метка «вы здесь» над текущим поселением.
  const [hit, setHit] = useState<MapHit | null>(null);
  const here = MAP_NODES.find(n => n.id === current);
  function tap(event: React.MouseEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * 100, y = ((event.clientY - box.top) / box.height) * 100;
    setHit(mapHitAt(x, y, 4, 12, known));
  }
  return <div className="map-shell">
    <svg viewBox="0 0 100 100" role="img" aria-label="Карта Ардана" onClick={tap}>
      {MAP_IMAGE ? <image href={MAP_IMAGE.src} x="0" y="0" width="100" height="100" preserveAspectRatio="none" /> : COUNTRY_SHAPES.map(shape=>{
        const country=COUNTRIES.find(item=>item.id===shape.countryId);
        return <polygon key={shape.countryId} points={shape.points.map(point=>point.join(",")).join(" ")} className={`country-shape country-${shape.countryId}`}><title>{country?.name ?? shape.countryId}</title></polygon>;
      })}
      {!MAP_IMAGE && MAP_WATERS.map(w => w.kind === "sea" ? <polygon key={w.id} points={w.points.map(p=>p.join(",")).join(" ")} className="map-sea"/> : <polyline key={w.id} points={w.points.map(p=>p.join(",")).join(" ")} className="map-river"/>)}
      {!MAP_IMAGE && <text x="57" y="56" className="map-water-label">море Лиар</text>}
      <g className="map-compass" transform="translate(94 8)"><path d="M0 -5 L1.6 0 L0 -1 L-1.6 0 Z"/><text x="0" y="3.8">С</text></g>
      {ROUTES.map((edge,i)=>{
        const from=MAP_NODES.find(n=>n.id===edge.from), to=MAP_NODES.find(n=>n.id===edge.to);
        if(!from||!to||!known.has(from.id)||!known.has(to.id)) return null;
        const selected=route.some(r=>(r.from===edge.from&&r.to===edge.to)||(r.from===edge.to&&r.to===edge.from));
        return <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={selected?"map-route selected":"map-route"}/>;
      })}
      {MAP_NODES.filter(node => known.has(node.id)).map(node=><g key={node.id} className="map-node">
        <circle cx={node.x} cy={node.y} r={node.id===current?2.5:node.id===destination?2.1:1.4} className={node.id===current?"current":node.id===destination?"destination":""}/>
        {(node.kind === "capital" || node.id===current || node.id===destination) && <text x={node.x > 78 ? node.x-2 : node.x+2} y={node.y-1.5} textAnchor={node.x > 78 ? "end" : "start"} className="map-label">{node.name}</text>}
      </g>)}
      {here && <g className="map-pin" transform={`translate(${here.x} ${here.y})`}><path d="M0 0 L-2.2 -4.2 A2.6 2.6 0 1 1 2.2 -4.2 Z" /><circle cx="0" cy="-5.6" r="1" /></g>}
      {hit && <circle cx={hit.x} cy={hit.y} r="3.2" className="map-hit" />}
    </svg>
    {hit ? <div className="map-card" role="status"><b>{hit.name}</b><span>{hit.detail}</span>{hit.id === current && <em>Вы здесь</em>}{hit.kind === "settlement" && hit.id !== current && (() => { const r = findVeloriaRoute(current, hit.id); if (!r) return <span>Отсюда туда дороги нет.</span>; const how = [...new Set(r.segments.map(s => s.mode === "sea" ? "морем" : s.mode === "river" ? "по реке" : s.mode === "mountain-pass" ? "горным перевалом" : "по дороге"))].join(", "); return <span>Путь от вас: около {r.totalDays} {r.totalDays % 10 === 1 && r.totalDays % 100 !== 11 ? "дня" : "дней"} ({how}).</span>; })()}<button aria-label="Закрыть" onClick={() => setHit(null)}>×</button></div>
      : <p className="map-tip">Нажмите на карту, чтобы узнать, что это за место.</p>}
    <div className="map-legend"><span><i className="legend-current"/>Вы здесь</span><span><i className="legend-destination"/>Цель</span><span><i className="legend-route"/>Выбранный путь</span></div>
  </div>;
}

export default function App() {
  const [worldId, setWorldId] = useState(DEFAULT_WORLD_ID);
  const [tab, setTab] = useState<Tab>("ПЕРСОНАЖ");
  const [game, setGame] = useState<GameState>(() => createInitialState(getWorldEntry(DEFAULT_WORLD_ID)!.create()));
  const [log, setLog] = useState<string[]>(() => game.playerMemory.map(m => m.text));
  const [action, setAction] = useState("");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<VeloriaCharacterDraft>(() => ({ ...draftForOrigin({ ...initialDraft, age: 0, name: "" }, BIRTH_ORIGINS[0]!), familySeed: createFamilySeed() }));
  const [difficulty, setDifficulty] = useState<WorldDifficultyId>("balanced");
  const [destinationId, setDestinationId] = useState("varentport");
  const [saved, setSaved] = useState(false);
  const [worldDraft, setWorldDraft] = useState({ name:"Новый мир", genre:"Фэнтези", era:"Средневековье", technology:"Ремесленная", magic:"Редкая", description:"" });
  const [saveText, setSaveText] = useState("");
  const [notice, setNotice] = useState("");
  const [autosave, setAutosave] = useState<AutosaveInfo>({ ok: false });
  // При запуске продолжаем с места, где игрок остановился.
  useEffect(() => {
    const text = readAutosave();
    if (!text) return;
    const imported = importGamePayload(text, WORLDS.map(world => world.id), "demo");
    if (!imported || !imported.game.playerProfile || loadBlockedByDeath(imported.game, loadGraveyard())) return;
    const migrated = migrateStateForWorld(imported.worldId, imported.game);
    setWorldId(imported.worldId); setGame(migrated); setLog(migrated.playerMemory.map(m => m.text)); setTab("ИГРА");
    setNotice("Продолжаем с того места, где вы остановились.");
  }, []);
  useEffect(() => {
    if (!game.playerProfile) return;
    const timer = setTimeout(() => setAutosave(writeAutosave(worldId, game)), 600);
    const flush = () => { if (document.visibilityState === "hidden") setAutosave(writeAutosave(worldId, game)); };
    document.addEventListener("visibilitychange", flush);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", flush); };
  }, [game, worldId]);
  // ИИ необязателен: ключ игрока живёт только в памяти этой сессии, адрес прокси и флаг: в localStorage.
  const keySession = useMemo(() => new UnlockedKeySession(), []);
  const [aiEndpoint, setAiEndpoint] = useState(() => readPref("openworld.ai.endpoint", "http://localhost:8787"));
  const [aiEnabled, setAiEnabled] = useState(() => readPref("openworld.ai.enabled", "false") === "true");
  const [aiProvider, setAiProvider] = useState<AiProviderId>(() => { const v = readPref("openworld.ai.provider", "anthropic"); return isAiProviderId(v) ? v : "anthropic"; });
  const [aiModel, setAiModel] = useState(() => readPref("openworld.ai.model", ""));
  const [aiBusy, setAiBusy] = useState(false);
  const [, setKeyTick] = useState(0);
  const [lang, setLang] = useState<GameLanguage>(() => { const v = readPref("openworld.lang", "ru"); return isGameLanguage(v) ? v : "ru"; });
  const sceneHintShown = useRef(false);
  const [narrationPerson, setNarrationPerson] = useState<NarrationPerson>(() => { const v = readPref("openworld.narration-person", "2"); return isNarrationPerson(v) ? v : "2"; });
  // Возраст игрока считается по дате рождения на сегодняшний день; дата хранится только в этом браузере.
  const [birthDate, setBirthDate] = useState(() => readPref("openworld.birthdate", ""));
  const [birthInput, setBirthInput] = useState("");
  const [birthError, setBirthError] = useState("");
  const playerRealAge = ageFromBirthDate(birthDate);
  const isAdultPlayer = playerRealAge !== null && playerRealAge >= 18;
  // Аккаунт (0.17.0): при входе дата рождения, взрослый режим, бан и сохранения живут в облаке.
  const cloud = useMemo(() => getCloud(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cloudSavedAt, setCloudSavedAt] = useState<string>();
  // Окончательная смерть: список умерших героев, чтобы старое сохранение их не воскресило.
  const [graveyard, setGraveyard] = useState<GraveRecord[]>(() => loadGraveyard());
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;
  const localSafety = useMemo(() => localSafetyStore(), []);
  const [safety, setSafety] = useState(() => localSafety.load());
  // Предупреждения пишутся и в браузер, и в аккаунт: бан привязан к аккаунту, его не обойти очисткой браузера.
  const safetyStore = useMemo<SafetyStore>(() => ({
    load: () => localSafety.load(),
    save: record => localSafety.save(record),
    report: (_record, reason) => {
      if (!cloud || !sessionRef.current) return;
      void reportChildSafetyStrike(cloud, reason).then(server => {
        const merged = { ...localSafety.load(), strikes: server.strikes, banned: server.banned || localSafety.load().banned };
        localSafety.save(merged); setSafety(merged);
      }).catch(() => { /* предупреждение уже записано локально */ });
    }
  }), [cloud, localSafety]);
  const [adultContent, setAdultContent] = useState(() => readPref("openworld.adult-content", "false") === "true");
  useEffect(() => {
    if (!cloud) return;
    void cloud.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = cloud.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, [cloud]);
  useEffect(() => {
    if (!cloud || !session) { setProfile(null); return; }
    let cancelled = false;
    void fetchProfile(cloud, session.user.id).then(async p => {
      if (cancelled || !p) return;
      setProfile(p);
      if (p.banned) { const banned = { ...localSafety.load(), banned: true }; localSafety.save(banned); setSafety(banned); }
      if (p.birthDate) { writePref("openworld.birthdate", p.birthDate); setBirthDate(p.birthDate); }
      setAdultContent(p.adultMode); writePref("openworld.adult-content", String(p.adultMode));
      // Ключ ИИ: если в этом браузере его нет, берём зашифрованную запись из аккаунта (пароль всё равно нужен).
      if (!loadVaultRecord()) { const remote = await getCloudKey(cloud).catch(() => null); if (remote) { saveVaultRecord(remote); setKeyTick(n => n + 1); } }
    }).catch(error => setNotice(error instanceof Error ? error.message : String(error)));
    return () => { cancelled = true; };
  }, [cloud, session?.user.id]);
  // Смерть героя записывается навсегда: в браузер и, при входе, в аккаунт.
  useEffect(() => {
    const next = buryIfDead(worldId, game, graveyard);
    if (next === graveyard) return;
    setGraveyard(next); saveGraveyard(next);
    if (cloud && session) void putCloudSave(cloud, GRAVEYARD_WORLD, GRAVEYARD_SLOT, JSON.stringify(next)).catch(() => undefined);
  }, [game.lifeStatus, worldId]);
  useEffect(() => {
    if (!cloud || !session) return;
    void getCloudSave(cloud, GRAVEYARD_WORLD, GRAVEYARD_SLOT).then(json => {
      const remote = json ? JSON.parse(json) as GraveRecord[] : [];
      const merged = mergeGraveyards(loadGraveyard(), Array.isArray(remote) ? remote : []);
      setGraveyard(merged); saveGraveyard(merged);
      if (merged.length !== remote.length) void putCloudSave(cloud, GRAVEYARD_WORLD, GRAVEYARD_SLOT, JSON.stringify(merged)).catch(() => undefined);
    }).catch(() => undefined);
  }, [cloud, session?.user.id]);
  // Дата рождения, указанная до входа, один раз уходит в аккаунт.
  useEffect(() => {
    if (!cloud || !profile || profile.birthDate || !birthDate || ageFromBirthDate(birthDate) === null) return;
    void saveBirthDate(cloud, profile.id, birthDate).then(() => setProfile({ ...profile, birthDate })).catch(error => setNotice(error instanceof Error ? error.message : String(error)));
  }, [cloud, profile, birthDate]);
  // Облачное автосохранение не чаще раза в 20 секунд и при сворачивании вкладки.
  const lastCloudSave = useRef(0);
  useEffect(() => {
    if (!cloud || !session || !game.playerProfile || safety.banned) return;
    const push = () => {
      lastCloudSave.current = Date.now();
      const json = JSON.stringify({ schemaVersion: 1, worldId, game, savedAt: new Date().toISOString() });
      void putCloudSave(cloud, worldId, AUTO_SLOT, json).then(() => setCloudSavedAt(new Date().toISOString())).catch(() => { /* локальное автосохранение есть */ });
    };
    const wait = Math.max(1500, 20_000 - (Date.now() - lastCloudSave.current));
    const timer = setTimeout(push, wait);
    const flush = () => { if (document.visibilityState === "hidden") { clearTimeout(timer); push(); } };
    document.addEventListener("visibilitychange", flush);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", flush); };
  }, [cloud, session?.user.id, game, worldId, safety.banned]);
  /** После сохранения или удаления ключа в настройках ИИ повторяем это в аккаунте. */
  function syncKeyToCloud() {
    setKeyTick(n => n + 1);
    if (!cloud || !session) return;
    const record = loadVaultRecord();
    void (record ? putCloudKey(cloud, record) : deleteCloudKeys(cloud)).catch(error => setNotice(error instanceof Error ? error.message : String(error)));
  }
  function toggleAdult(on: boolean) {
    setAdultContent(on); writePref("openworld.adult-content", String(on));
    if (cloud && profile) void saveAdultMode(cloud, profile.id, on).then(() => setProfile({ ...profile, adultMode: on })).catch(error => { setAdultContent(false); writePref("openworld.adult-content", "false"); setNotice(error instanceof Error ? error.message : String(error)); });
  }

  // Мир собирается под персонажа из рецепта кампании; без рецепта используется базовый мир.
  const world = useMemo(() => resolveWorldForState(worldId, game.campaign) ?? getWorldEntry(worldId)!.create(), [worldId, game.campaign]);
  const caps = useMemo(() => capabilities(game.development, game.minute), [game.development, game.minute]);
  const veloriaWorld = useMemo(() => getWorldEntry("veloria")!.create(), []);
  const location = world.locations[game.playerLocation] ?? world.locations[world.startLocationId]!;
  const currentSettlementId = game.settlementId ?? "roven";
  const currentSettlement = MAP_NODES.find(node => node.id === currentSettlementId);
  const selectedRoute = useMemo(() => findVeloriaRoute(currentSettlementId, destinationId), [currentSettlementId, destinationId]);
  const statuses = useMemo(() => availableStatuses(draft.originId), [draft.originId]);
  const professions = useMemo(() => availableProfessions(draft.originId, draft.statusId), [draft.originId, draft.statusId]);
  const scenarios = useMemo(() => availableScenarios(draft.originId), [draft.originId]);
  const validation = useMemo(() => resolveVeloriaStart(draft), [draft]);
  const familyAssignment = useMemo(() => generateVeloriaFamily(draft), [draft.familySeed, draft.name, draft.age, draft.originId, draft.familyState, draft.parentalUnionStatus, draft.dynasticRole]);
  const inheritedOptions = useMemo(() => {
    if (familyAssignment.biologicalParents.length !== 2) return null;
    const options = getChildAppearanceOptions(familyAssignment.biologicalParents[0], familyAssignment.biologicalParents[1]);
    return options.parentsKnown ? options : null;
  }, [familyAssignment]);
  const selectedInheritedAppearance = useMemo(() => {
    const fallback = familyAssignment.defaultAppearance;
    if (!fallback) return undefined;
    if (draft.dynasticRole === "second-prince") return { skinTone: 3 as const, hairColor: "light-blond" as const, hairTexture: "straight" as const, eyeColor: "dark-brown" as const, facialFeatures: "east-asian" as const };
    return {
      skinTone: draft.skinTone ?? fallback.skinTone,
      hairColor: draft.hairColor ?? fallback.hairColor,
      hairTexture: draft.hairTexture ?? fallback.hairTexture,
      eyeColor: draft.eyeColor ?? fallback.eyeColor,
      facialFeatures: draft.facialFeatures ?? fallback.facialFeatures
    };
  }, [familyAssignment, draft.skinTone, draft.hairColor, draft.hairTexture, draft.eyeColor, draft.facialFeatures]);
  const appearanceErrors = useMemo(() => {
    if (familyAssignment.biologicalParents.length !== 2 || !selectedInheritedAppearance) return [];
    return validateChildAppearance(familyAssignment.biologicalParents[0]!, familyAssignment.biologicalParents[1]!, selectedInheritedAppearance);
  }, [familyAssignment, selectedInheritedAppearance]);
  const familyErrors = useMemo(() => familyAssignment.record ? validateFamilyRecord(familyAssignment.record) : [], [familyAssignment]);
  const dynasticHeirOptions = useMemo(() => documentedDynasticOptions("heir"), []);
  const acknowledgedBastards = useMemo(() => documentedAcknowledgedBastards(), []);
  /** Старт с рождения: взрослые поля анкеты (рост, профессия, навыки) не показываются. */
  const isBirthStart = draft.dynasticRole === "second-prince" || draft.age === 0;
  const total = Object.values(draft.attributes).reduce((sum, n) => sum + n, 0);
  const diary = useMemo(() => { const q = query.trim().toLocaleLowerCase("ru"); return q ? game.playerMemory.filter(m => m.text.toLocaleLowerCase("ru").includes(q)) : game.playerMemory; }, [game.playerMemory, query]);
  const people = useMemo(() => knownPeople(world, game), [world, game]);
  const homeStateId = birthOrigin((game.campaign?.recipe as { draft?: { birthOriginId?: string } } | undefined)?.draft?.birthOriginId)?.stateId;
  const knownPlaces = useMemo(() => knownSettlementIds(game.settlementId ?? "roven", homeStateId, game.visitedSettlements), [game.settlementId, homeStateId, game.visitedSettlements]);
  // Где герой побывал, остаётся на его карте.
  useEffect(() => {
    const here = game.settlementId;
    if (!here || !game.playerProfile || game.visitedSettlements?.includes(here)) return;
    setGame(g => g.settlementId === here ? { ...g, visitedSettlements: [...(g.visitedSettlements ?? []), here] } : g);
  }, [game.settlementId, game.playerProfile]);
  const quick = useMemo(() => {
    const here = world.locations[game.playerLocation];
    const go = (here?.exits ?? []).map(e => `идти ${world.locations[e.to]?.name ?? e.to}`);
    const buy = here?.shop ? Object.keys(here.shop.prices).map(id => `купить ${world.items[id]?.name ?? id}`) : [];
    // Быстрые действия зависят от возраста: младенцу не предлагаются прогулки и покупки.
    const reachable = caps.canWalk ? go : [];
    return ["осмотреться", ...(caps.stage.id === "infancy" ? [] : ["инвентарь"]), "подождать", ...reachable, ...(caps.canTrade ? buy : [])];
  }, [world, game.playerLocation, caps]);

  const aiLimit = () => Number(readPref("openworld.ai.daily-limit", "50"));
  const aiLimitReached = () => aiLimit() > 0 && loadUsage().requests >= aiLimit();
  const makeProxy = () => new ProxyActionProposer(aiEndpoint, keySession, { provider: aiProvider, model: aiModel, onUsage: usage => recordUsage({ requests: 1, inputTokens: usage.input, outputTokens: usage.output }) });
  /** После реплики, жеста или детского действия люди рядом отвечают живыми словами, написанными ИИ. */
  function liveScene(after: GameState, playerText: string, event: SceneEvent) {
    // Осмотр и приход описываются литературно даже в пустом месте; разговор нужен только при слушателях.
    const descriptive = event === "look" || event === "arrival";
    if (!descriptive && !hasListeners(world, after)) return;
    if (!aiEnabled || aiLimitReached()) {
      if (!descriptive && !sceneHintShown.current) {
        sceneHintShown.current = true;
        setLog(l => [...l, aiEnabled
          ? `Дневной лимит запросов к ИИ (${aiLimit()}) исчерпан, поэтому люди рядом пока молчат. Лимит меняется во вкладке «Система».`
          : "Люди рядом вас слышат. Чтобы они отвечали своими словами, подключите ИИ во вкладке «Система»."]);
      }
      return;
    }
    const context = buildSceneContext(world, after, playerText, { lang, event, person: narrationPerson, adult: isAdultPlayer && adultContent });
    const envelope = buildSceneEnvelope(context, playerText);
    setAiBusy(true);
    makeProxy().writeScene(envelope).then(raw => {
      const scene = coerceScene(raw, envelope.outputContract.speakers, after.playerName, context.adult);
      if (!scene) return;
      const applied = applyScene(world, after, scene);
      setGame(current => current === after ? applied.state : current);
      setLog(l => [...l, ...applied.lines]);
    }).catch(() => setLog(l => [...l, "ИИ сейчас недоступен, ответ мира не пришёл. Мир не изменился."]))
      .finally(() => setAiBusy(false));
  }
  const SOCIAL_INFANT_ACTS: InfantActId[] = ["cry", "smile", "babble", "reach", "cling", "play"];
  function sceneFor(next: import("./engine/types").ActionResult, performed: import("./engine/types").Action, text: string) {
    if (!next.ok || next.state.lifeStatus === "dead") return;
    if (performed.type === "say") liveScene(next.state, text, "speech");
    else if (performed.type === "gesture") liveScene(next.state, text, "gesture");
    else if (performed.type === "look") liveScene(next.state, text || "осмотреться", "look");
    else if (performed.type === "move") liveScene(next.state, text || "иду дальше", "arrival");
    else if (performed.type === "infant" && SOCIAL_INFANT_ACTS.includes(performed.act)) liveScene(next.state, `(${INFANT_ACT_LABELS[performed.act]})`, "infant");
  }
  /** Защита детей-персонажей: ход не выполняется, предупреждение, после трёх предупреждений бан. */
  function blockedForChildSafety(text: string): boolean {
    if (!isChildSafetyViolation(world, game, text)) return false;
    const { record, message } = registerViolation(safetyStore);
    setSafety(record);
    setLog(l => [...l, message]);
    return true;
  }
  function run(text: string) {
    if (safety.banned || blockedForChildSafety(text)) return;
    if (game.journey) { setLog(l => [...l, "Во время путешествия нельзя выполнять городские действия. Продолжите путь на вкладке «Дорога»."]); return; }
    const parsed = parseAction(world, text);
    if (!parsed.ok) {
      // Сначала пробуем понять обычную речь без ИИ: это бесплатно и мгновенно.
      const local = understandFreeText(world, game, text);
      if (local?.ok) {
        if (aiEnabled) recordUsage({ understoodLocally: 1 });
        const result = applyAction(world, game, local.action);
        setGame(result.state); setLog(l => [...l, ...result.message.split("\n")]);
        sceneFor(result, local.action, text);
        return;
      }
      if (!aiEnabled || aiBusy) { setLog(l => [...l, parsed.reason]); return; }
      if (aiLimitReached()) { setLog(l => [...l, `Дневной лимит запросов к ИИ (${aiLimit()}) исчерпан. Команды без ИИ работают как обычно, лимит меняется в «Системе».`]); return; }
      // Свободный текст: ИИ только предлагает действие, движок проверяет его по правилам и возрасту.
      setAiBusy(true); setLog(l => [...l, `> ${text}`, "ИИ разбирает намерение…"]);
      const snapshot = game;
      void resolveWithAi(world, snapshot, text, new CachingProposer(makeProxy(), () => recordUsage({ cacheHits: 1 }))).then(result => {
        setAiBusy(false);
        setGame(current => current === snapshot ? result.state : current);
        setLog(l => [...l, ...result.message.split("\n")]);
        // Сцена строится только если мир не изменился, пока ИИ думал.
        if (result.action && result.ok) sceneFor(result, result.action, result.action.type === "say" || result.action.type === "gesture" ? result.action.text : text);
      }, () => setAiBusy(false));
      return;
    }
    const result = applyAction(world, game, parsed.action);
    setGame(result.state); setLog(l => [...l, ...result.message.split("\n")]);
    sceneFor(result, parsed.action, parsed.action.type === "say" || parsed.action.type === "gesture" ? parsed.action.text : text);
  }
  function submitAction(e: FormEvent) { e.preventDefault(); if (action.trim()) run(action); setAction(""); }
  function patchDraft<K extends keyof VeloriaCharacterDraft>(key: K, value: VeloriaCharacterDraft[K]) {
    setDraft(d => {
      const next = { ...d, [key]: value };
      if (key === "name") { next.skinTone = undefined; next.hairColor = undefined; next.hairTexture = undefined; next.eyeColor = undefined; next.facialFeatures = undefined; }
      return next;
    });
    setSaved(false);
  }
  function updateAttribute(name: string, value: number) { setDraft(d => ({ ...d, attributes: { ...d.attributes, [name]: value } })); setSaved(false); }
  function launchCampaign(continueWorld: boolean, freshWorldAfterDeath = false) {
    const result = startVeloriaCampaign({ kind: "veloria-character", draft, difficultyId: difficulty }, continueWorld && worldId === "veloria" ? game : undefined);
    if (!result.ok) { setNotice(result.errors.join(" ")); setTab("ПЕРСОНАЖ"); return; }
    setWorldId("veloria"); setGame({ ...result.state, lifeId: newLifeId() }); setLog(result.state.playerMemory.map(m => m.text)); setSaved(true);
    setNotice(freshWorldAfterDeath ? "Создана новая версия мира: прежняя хроника и память NPC остались в завершённой кампании." : result.notice); setTab("ИГРА");
  }
  function createCharacter() { launchCampaign(game.lifeStatus === "dead"); }
  function runAct(act: InfantActId) { runParsed({ type: "infant", act }, INFANT_ACT_LABELS[act]); }
  function runLive(days: number) { runParsed({ type: "live", days }, `прожить ${days} дн.`); }
  function runParsed(parsedAction: import("./engine/types").Action, _label: string) {
    if (game.journey) { setLog(l => [...l, "Во время путешествия используйте вкладку «Дорога»."]); return; }
    const result = applyAction(world, game, parsedAction);
    setGame(result.state); setLog(l => [...l, ...result.message.split("\n")]);
    sceneFor(result, parsedAction, _label);
  }
  function startJourney() {
    if (worldId !== "veloria") { setNotice("Глобальная карта путешествий доступна только в кампании Велории."); return; }
    const result = beginVeloriaJourney(game, destinationId);
    if (result.ok) setGame(result.state);
    setNotice(result.message);
    if (result.ok) setLog(l => [...l, result.message]);
  }
  function advanceJourney() {
    if (worldId !== "veloria") { setNotice("Путешествие не относится к выбранному миру."); return; }
    const result = advanceVeloriaJourney(game);
    if (result.ok) setGame(result.state);
    if (result.arrived) setDestinationId("roven");
    setNotice(result.message);
    if (result.ok) setLog(l => [...l, result.message]);
  }
  function startNewWorldFromDeath() { launchCampaign(false, true); }
  /** После смерти: то же происхождение, но новая семья и новая жизнь (герой собирается заново). */
  function rebornSameOrigin() {
    const prev = (game.campaign?.recipe as { draft?: VeloriaCharacterDraft } | undefined)?.draft;
    const origin = birthOrigin(prev?.birthOriginId) ?? BIRTH_ORIGINS[0]!;
    setDraft(d => ({ ...draftForOrigin({ ...(prev ?? d), name: "" }, origin), familySeed: createFamilySeed() }));
    setSaved(false); setTab("ПЕРСОНАЖ");
    setNotice("Новая жизнь с тем же происхождением. Семья и судьба будут другими.");
  }
  function switchWorld(id: string, playerName = game.playerName) {
    const entry = getWorldEntry(id); if (!entry) return;
    // У каждого мира своё сохранение: возвращаемся туда, где остановились в этом мире.
    const own = importGamePayload(readAutosave(undefined, id) ?? "", WORLDS.map(w => w.id), id);
    if (own && own.worldId === id && own.game.playerProfile && !loadBlockedByDeath(own.game, graveyard)) {
      const migrated = migrateStateForWorld(id, own.game);
      setWorldId(id); setGame(migrated); setLog(migrated.playerMemory.map(m => m.text)); setQuery(""); setNotice("Продолжаем ваше сохранение в этом мире.");
      return;
    }
    const next = createInitialState(entry.create(), playerName);
    setWorldId(id); setGame(next); setLog(next.playerMemory.map(m => m.text)); setQuery(""); setNotice("Создана новая сессия в выбранном мире.");
  }
  function exportSave() { setSaveText(JSON.stringify({ schemaVersion:1, worldId, game }, null, 2)); setNotice("Сохранение подготовлено в поле ниже. Скопируй его в файл."); }
  /** Сохранение файлом: на телефоне копировать сотни килобайт JSON из поля неудобно. */
  function downloadSave() {
    const blob = new Blob([JSON.stringify({ schemaVersion:1, worldId, game })], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `openworld-save-${yearKLOf(game.minute, game.worldStartYearKL ?? 742)}KL.json`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Файл сохранения скачан.");
  }
  function uploadSave(file: File | undefined) {
    if (!file) return;
    void file.text().then(text => importSave(text));
  }
  function importSave(source = saveText) {
    const imported = importGamePayload(source, WORLDS.map(world => world.id), "demo");
    if (!imported) { setNotice("Не удалось загрузить: формат, версия или выбранный мир сохранения неверны."); return; }
    const grave = loadBlockedByDeath(imported.game, graveyard);
    if (grave) { setNotice(DEATH_IS_FINAL_MESSAGE(grave.name)); return; }
    const migrated = migrateStateForWorld(imported.worldId, imported.game);
    setWorldId(imported.worldId); setGame(migrated); setLog(migrated.playerMemory.map(m => m.text));
    setNotice(imported.sourceFormat === "legacy-branch-save" ? "Старое сохранение движка 0.4 импортировано в демо-мир." : "Сохранение загружено.");
  }

  if (safety.banned) return <main className="shell age-gate">
    <section className="panel">
      <div className="eyebrow">ДОСТУП ЗАКРЫТ</div>
      <h2>Доступ к игре закрыт</h2>
      <p>После трёх предупреждений здесь снова была попытка сексуальных действий в отношении ребёнка. Такое в игре запрещено.</p>
    </section>
  </main>;

  if (playerRealAge === null) return <main className="shell age-gate">
    <section className="panel">
      <div className="eyebrow">ПЕРЕД НАЧАЛОМ</div>
      <h2>Укажите дату рождения</h2>
      <p>В этом мире есть жестокость, ложь, предательство и грубая речь. Откровенные сцены доступны только с 18 лет, поэтому нам нужна ваша дата рождения. {cloud ? "Если вы войдёте в аккаунт, она сохранится в нём, и изменить её потом нельзя." : "Она хранится только в этом браузере."}</p>
      <label>Дата рождения<input type="date" value={birthInput} max={new Date().toISOString().slice(0, 10)} onChange={e => { setBirthInput(e.target.value); setBirthError(""); }} /></label>
      <div className="save-row"><button disabled={!birthInput} onClick={() => {
        if (ageFromBirthDate(birthInput) === null) { setBirthError("Проверьте дату."); return; }
        writePref("openworld.birthdate", birthInput); setBirthDate(birthInput);
      }}>ПРОДОЛЖИТЬ</button></div>
      {birthError && <p className="hint">{birthError}</p>}
      {cloud && !session && <><div className="divider-line"/><p className="hint">Уже играли на другом устройстве? Войдите, и игра возьмёт дату и сохранения из аккаунта.</p><SignInForm cloud={cloud} compact /></>}
      {session && <p className="hint">Вы вошли как {session.user.email ?? "игрок"}. Дату рождения сохраним в аккаунте.</p>}
    </section>
  </main>;

  return <main className="shell">
    <header className="topbar"><div><div className="eyebrow">TEXT ROLEPLAY SIMULATOR</div><h1>LIVING WORLD <span>RPG</span></h1></div><div className="status"><i /> LOCAL ALPHA</div></header>
    <nav className="tabs">{TABS.map(item => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>
    {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}

    {tab === "ИГРА" && <section className="panel">
      <div className="section-head"><div><div className="eyebrow">ТЕКУЩАЯ СЕССИЯ</div><h2>{world.name}</h2></div><div className="clock">{yearKLOf(game.minute, game.worldStartYearKL ?? 742)} KL · день {dayOfYear(game.minute)} года · {formatClock(game.minute)}</div></div>
      <label>Мир<select value={worldId} onChange={e => switchWorld(e.target.value)}>{WORLDS.map(w => <option key={w.id} value={w.id}>{w.name}: {w.subtitle}</option>)}</select></label>
      <div className="location">⌖ {currentSettlementId !== "roven" ? `${currentSettlement?.name ?? currentSettlementId} · ${location.name}` : location.name}</div>
      {game.playerProfile && <div className="profile-strip"><b>{game.playerName}</b> · {game.development ? formatAge(game.development, game.minute) : `${game.playerProfile.age} лет`} · {birthOrigin((game.campaign?.recipe as { draft?: { birthOriginId?: string } } | undefined)?.draft?.birthOriginId)?.label ?? VELORIA_ORIGIN_LABELS[game.playerProfile.originId as VeloriaOriginId] ?? game.playerProfile.originId}{game.playerProfile.professionId !== "none" ? ` · ${PROFESSION_LABELS[game.playerProfile.professionId as VeloriaProfessionId] ?? game.playerProfile.professionId}` : ""}<br/><span>{game.development ? `${Math.round(game.development.physical.heightCm)} см · ${game.development.physical.weightKg} кг` : `${game.playerProfile.heightCm ? `${game.playerProfile.heightCm} см` : "Рост не указан"} · ${game.playerProfile.weightKg ? `${game.playerProfile.weightKg} кг` : "Вес не указан"}`} · {FAITHS.find(f=>f.id===game.playerProfile?.faithId)?.name ?? "Вера не указана"} · сложность: {WORLD_DIFFICULTIES[game.playerProfile.difficultyId].label}</span>{game.playerProfile.familySummary && <p>{game.playerProfile.familySummary}</p>}</div>}
      {game.development && <LifePanel world={world} game={game} onAct={runAct} onLive={runLive} onHour={() => runParsed({ type: "wait", minutes: 60 }, "подождать час")} />}
      {game.playerAppearance && <div className="start-preview"><b>Ваш нынешний облик</b><p>{describeAppearance(game.playerAppearance)}</p></div>}
      {game.socialState && (game.socialState.suspicion > 0 || game.socialState.heresySuspicion > 0) && <div className="warning"><b>Общественная репутация</b><p>Подозрение: {game.socialState.suspicion}/100 · подозрение в ереси: {game.socialState.heresySuspicion}/100 · правовой статус: {({none:"нет дела",watched:"за вами наблюдают",summoned:"вызов на разбирательство",detained:"задержан(а)",condemned:"приговорён(а)",deposed:"свергнут(а)"} as Record<string,string>)[game.socialState.legalCase] ?? game.socialState.legalCase}.</p><p>Попытки создать религиозное движение: {game.socialState.cultAttempts} · реальные сторонники: {(game.socialState.followers?.length ?? 0)}. Стадия: {({none:"нет",rumor:"слухи",sect:"небольшая секта",cult:"устойчивый культ"} as Record<string,string>)[game.socialState.movement] ?? "нет"}.</p></div>}
      {game.lifeStatus === "dead" && <div className="warning"><b>История этого персонажа завершена.</b><p>{game.deathRecord ? `Причина: ${game.deathRecord.cause}. Место: ${MAP_NODES.find(n=>n.id===game.deathRecord?.locationId)?.name ?? game.deathRecord.locationId}.` : "Смерть зафиксирована в сохранении."} Смерть в этом мире окончательна: ни старое сохранение, ни облако героя не вернут.</p><div className="save-row"><button className="primary" onClick={rebornSameOrigin}>РОДИТЬСЯ ЗАНОВО ТЕМ ЖЕ</button><button onClick={()=>setTab("ПЕРСОНАЖ")}>НОВАЯ ЖИЗНЬ</button><button onClick={startNewWorldFromDeath}>НАЧАТЬ МИР ЗАНОВО</button></div></div>}
      <div className="story">{log.map((line, i) => <p key={i}>{line}</p>)}</div>
      <div className="quick">{quick.map(q => <button key={q} type="button" onClick={() => run(q)}>{q}</button>)}</div>
      <form className="action-form" onSubmit={submitAction}><input value={action} onChange={e => setAction(e.target.value)} placeholder="Что вы хотите сделать?"/><button className="primary">ДЕЙСТВИЕ</button></form>
      <p className="hint">{caps.stage.id === "infancy" ? "Младенец не ходит и не говорит: он плачет, спит, ест, смотрит, улыбается и тянется к близким. Взрослые сами решают, куда его нести. Время удобнее проживать кнопками «Прожить»." : <>Команды: «осмотреться», «инвентарь», «подождать [N мин/часов]», «идти &lt;место&gt;», «купить &lt;товар&gt; [N]», «сказать [реплика]», «показываю [жест]», «прожить [N дней/месяц/год]». Возможности зависят от возраста: длина речи, дальность самостоятельных прогулок и покупки открываются по мере взросления.</>}</p>
    </section>}

    {tab === "ПЕРСОНАЖ" && <section className="panel">
      <NewLifeWizard draft={draft} setDraft={update => { setDraft(update); setSaved(false); }} difficulty={difficulty} setDifficulty={id => { setDifficulty(id); setSaved(false); }} onStart={createCharacter} newSeed={createFamilySeed} />
      {saved && <span className="saved">✓ Персонаж создан</span>}
    </section>}

    {tab === "ДОРОГА" && <section className="panel"><div className="eyebrow">ГЛОБАЛЬНАЯ КАРТА</div><h2>Путешествие по Ардану</h2>
      <div className="location">Сейчас: {currentSettlement?.name ?? currentSettlementId}{game.journey ? " · в пути" : ""}</div>
      <ArdanMap current={currentSettlementId} destination={game.journey?.destinationId ?? destinationId} route={game.journey?.route ?? selectedRoute?.segments ?? []} known={knownPlaces}/>
      {game.journey ? <div className="journey-card"><b>Маршрут до {MAP_NODES.find(n=>n.id===game.journey!.destinationId)?.name ?? game.journey.destinationId}</b><p>Сейчас: {MAP_NODES.find(n=>n.id===game.journey!.route[game.journey!.segmentIndex]?.from)?.name ?? game.journey.route[game.journey.segmentIndex]?.from} → {MAP_NODES.find(n=>n.id===game.journey!.route[game.journey!.segmentIndex]?.to)?.name ?? game.journey.route[game.journey.segmentIndex]?.to}</p><p>Участок {game.journey.segmentIndex+1} из {game.journey.route.length}. Осталось дней на участке: <strong>{game.journey.daysRemaining}</strong>. В пути: {game.journey.elapsedDays} дн.</p><p className="hint">Время продвигается по одному дню за действие. При достижении промежуточного пункта обновляется положение героя.</p><button className="primary" onClick={advanceJourney}>ПРОДВИНУТЬСЯ НА ОДИН ДЕНЬ</button></div> : <>
        <label>Куда отправиться<select value={destinationId} onChange={e=>setDestinationId(e.target.value)}>{MAP_NODES.filter(node=>node.id!==currentSettlementId&&knownPlaces.has(node.id)).map(node=><option key={node.id} value={node.id}>{node.name}, {COUNTRIES.find(c=>c.id===node.countryId)?.name}</option>)}</select></label>
        {selectedRoute ? <div className="start-preview"><b>Маршрут: {selectedRoute.totalDays} игровых дней</b><p>{selectedRoute.segments.map(segment=>`${MAP_NODES.find(n=>n.id===segment.from)?.name ?? segment.from} → ${MAP_NODES.find(n=>n.id===segment.to)?.name ?? segment.to} (${segment.days} дн., ${segment.mode === "road" ? "дорога" : segment.mode === "river" ? "река" : segment.mode === "sea" ? "море" : "горный перевал"}, опасность: ${segment.danger === "low" ? "низкая" : segment.danger === "moderate" ? "умеренная" : "высокая"})`).join("; ")}</p><small>Погодные закрытия и сезонные ограничения пока показываются как справочные данные и будут подключены к календарю.</small></div> : <div className="warning">Маршрут между этими точками не найден.</div>}
        <button className="primary" disabled={!selectedRoute || selectedRoute.totalDays===0} onClick={startJourney}>НАЧАТЬ ПУТЕШЕСТВИЕ</button>
      </>}
      <h3 className="sub">Поселения на карте</h3><div className="region-list">{MAP_NODES.map(node=><div key={node.id}><b>{node.name}</b><span>{COUNTRIES.find(c=>c.id===node.countryId)?.name} · {node.kind}</span></div>)}</div>
      <p className="hint">Важно: межгородское перемещение уже учитывает время и промежуточные пункты, но подробная уличная симуляция пока реализована только для Ровена. При прибытии в другой город нельзя совершать местные действия, пока для него не добавлена отдельная карта улиц.</p>
    </section>}

    {tab === "МИР" && <section className="panel"><div className="eyebrow">КОНСТРУКТОР И КАНОН</div><h2>Велория, материк Ардан</h2><p className="hint">Первая кампания начинается в Ровене. Другие города и государства доступны через путешествия, а не выбор стартовой точки.</p>
      <div className="country-grid">{COUNTRIES.map(country=><article className="country-card" key={country.id}><b>{country.name}</b><span>{country.government}</span><small>Правитель: {country.ruler}</small><small>Столица: {MAP_NODES.find(n=>n.id===country.capital)?.name ?? country.capital}</small></article>)}</div>
      <h3 className="sub">Регионы</h3><div className="region-list">{REGIONS.map(region=><div key={region.id}><b>{region.name}</b><span>{COUNTRIES.find(c=>c.id===region.countryId)?.name} · {region.terrain}</span></div>)}</div>
      <div className="divider-line"/><h3 className="sub">Черновик собственного мира</h3><div className="form-grid">
        <label>Название<input value={worldDraft.name} onChange={e=>setWorldDraft({...worldDraft,name:e.target.value})}/></label><label>Жанр<select value={worldDraft.genre} onChange={e=>setWorldDraft({...worldDraft,genre:e.target.value})}><option>Фэнтези</option><option>Научная фантастика</option><option>Постапокалипсис</option><option>Современность</option><option>Исторический</option></select></label><label>Эпоха<input value={worldDraft.era} onChange={e=>setWorldDraft({...worldDraft,era:e.target.value})}/></label><label>Технологии<input value={worldDraft.technology} onChange={e=>setWorldDraft({...worldDraft,technology:e.target.value})}/></label><label>Магия<input value={worldDraft.magic} onChange={e=>setWorldDraft({...worldDraft,magic:e.target.value})}/></label></div>
        <label>Описание<textarea rows={3} maxLength={2000} value={worldDraft.description} onChange={e=>setWorldDraft({...worldDraft,description:e.target.value})}/></label><p className="hint">Пока это анкета-концепт: полноценный генератор государств, географии, законов и NPC ещё предстоит подключить.</p>
    </section>}

    {tab === "ПАМЯТЬ" && <section className="panel"><div className="eyebrow">ДНЕВНИК И ЛЮДИ</div><h2>Память</h2>
      <h3 className="sub">Дневник</h3><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по дневнику…"/>
      {diary.length ? <ul className="memory">{diary.map((m,i)=><li key={i}><span>{formatClock(m.minute)}</span>{m.text}</li>)}</ul> : <div className="placeholder">{game.playerMemory.length ? "Ничего не найдено." : "Записей пока нет."}</div>}
      <h3 className="sub">Люди</h3><p className="hint">Кого знает ваш герой. Что люди думают и помнят о нём, остаётся при них.</p>
      {people.length ? <div className="people-list">{people.map(p => <article key={p.id} className="person-card"><b>{p.name}</b>{p.role && <span className="person-role">{p.role}</span>}<span>{p.alive ? (p.age !== undefined ? ageText(p.age) : "") : "умер(ла)"}</span>{p.alive && p.nature && <p>{p.nature}</p>}{p.alive && p.looks && <p className="muted">{p.looks}</p>}</article>)}</div> : <div className="placeholder">Пока вы никого не знаете.</div>}
    </section>}

    {tab === "СИСТЕМА" && <section className="panel"><div className="eyebrow">СИСТЕМА</div><h2>Сохранение и состояние проекта</h2><p className="hint">{autosave.ok && autosave.savedAt ? `Автосохранение включено: последнее в ${new Date(autosave.savedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}. Игра сама продолжит с этого места.` : game.playerProfile ? "Автосохранение не удалось: в браузере нет места или хранилище закрыто. Сохраните игру файлом." : "Автосохранение начнётся, когда появится герой."}</p><div className="save-row"><button onClick={exportSave}>ПОДГОТОВИТЬ СОХРАНЕНИЕ</button><button onClick={() => importSave()}>ЗАГРУЗИТЬ ИЗ ПОЛЯ</button></div><div className="save-row"><button onClick={downloadSave}>СКАЧАТЬ ФАЙЛ</button><label className="file-button">ОТКРЫТЬ ФАЙЛ<input type="file" accept="application/json,.json" onChange={e => { uploadSave(e.target.files?.[0]); e.target.value = ""; }} /></label></div><label>JSON сохранения<textarea rows={12} value={saveText} onChange={e=>setSaveText(e.target.value)} placeholder="Нажми «Подготовить сохранение» или вставь JSON сюда…"/></label>
      <div className="ai-settings"><h3 className="sub">Повествование</h3>
        <label>Как рассказчик обращается к герою<select value={narrationPerson} onChange={e => { if (isNarrationPerson(e.target.value)) { setNarrationPerson(e.target.value); writePref("openworld.narration-person", e.target.value); } }}><option value="2">На «вы»: «Торговка смотрит на вас»</option><option value="3">По имени: «Торговка смотрит на Ирину»</option></select></label>
        <label className="inline-check"><input type="checkbox" disabled={!isAdultPlayer} checked={isAdultPlayer && adultContent} onChange={e => toggleAdult(e.target.checked)} /> Откровенные сцены между взрослыми персонажами{isAdultPlayer ? "" : " (доступно с 18 лет)"}</label>
        <p className="hint">Рассказчик никогда не решает за вашего героя. Жестокость и грубость в мире есть всегда; откровенные сцены только между взрослыми и только с этой галочкой. Если герой или кто-то рядом младше 18, такие сцены исключены полностью.</p>
      </div>
      <AiSettings lang={lang} onLang={value => { setLang(value); writePref("openworld.lang", value); }} session={keySession} endpoint={aiEndpoint} onEndpoint={value => { setAiEndpoint(value); writePref("openworld.ai.endpoint", value); }} enabled={aiEnabled} onEnabled={value => { setAiEnabled(value); writePref("openworld.ai.enabled", String(value)); }} provider={aiProvider} onProvider={value => { setAiProvider(value); writePref("openworld.ai.provider", value); }} model={aiModel} onModel={value => { setAiModel(value); writePref("openworld.ai.model", value); }} onChange={syncKeyToCloud} />
      <AccountPanel cloud={cloud} session={session} cloudSavedAt={cloudSavedAt} worldId={worldId} currentSaveJson={() => game.playerProfile ? JSON.stringify({ schemaVersion: 1, worldId, game, savedAt: new Date().toISOString() }) : null} onLoad={json => { importSave(json); setTab("ИГРА"); }} />
      <div className="warning">Реестры скрытых фигур и культов пока лежат в открытых исходниках; в публичном GitHub они не являются секретными. Для настоящей тайны потребуется приватный backend.</div>
      <ul className="checklist"><li>✓ Велорийский конструктор персонажа подключён к игровому состоянию</li><li>✓ Ровен: единственная стартовая точка первой кампании</li><li>✓ Происхождение, статус, профессия, семья и сценарий валидируются</li><li>✓ Сложность выбирается до начала кампании и не масштабируется автоматически</li><li>✓ Сохранение/загрузка JSON в интерфейсе</li><li>✓ Хроника, память NPC и отношения отображаются в интерфейсе</li><li>✓ Межгородские путешествия: дни пути, промежуточные поселения и запись в хронику</li><li>✓ NPC в Ровене учитывают время пешего перехода между точками расписания</li><li>✓ После зафиксированной смерти доступны преемник в продолжающемся мире или новая версия мира</li><li>○ Уличные карты остальных городов, глобальное перемещение NPC и самостоятельные решения</li><li>✓ Естественное старение героя от прошедшего игрового времени</li><li>○ Болезни, лечение, травмы и автоматические причины смерти</li><li>✓ Живые ответы NPC через нейросеть: свой голос по возрасту, характеру, сословию и краю, память о разговоре</li><li>○ Правосудие и самостоятельные действия NPC</li><li>○ Серверное хранение секретов и ИИ-посредник</li></ul>
    </section>}
    <footer>LIVING WORLD RPG <span>· 0.18.0 · локальная альфа</span></footer>
  </main>;
}
