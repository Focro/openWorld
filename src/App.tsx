import { createAppearanceState, describeAppearance, isHaircutDescriptionAllowed, isNonInheritedAppearanceDescriptionAllowed } from "./engine/appearance";
import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { applyAction } from "./engine/rules";
import { parseAction } from "./engine/parse";
import { resolveWithAi } from "./engine/ai";
import { UnlockedKeySession } from "./ai/keyVault";
import { ProxyActionProposer, isAiProviderId, type AiProviderId } from "./ai/proxyClient";
import { AiSettings } from "./ui/AiSettings";
import { understandFreeText } from "./engine/intent";
import { applyScene, buildSceneContext, buildSceneEnvelope, coerceScene, hasListeners, isGameLanguage, type GameLanguage } from "./engine/speech";
import { CachingProposer } from "./ai/intentCache";
import { loadUsage, recordUsage } from "./ai/usage";
import { createInitialState } from "./engine/world";
import { importGamePayload } from "./engine/save";
import { DEFAULT_WORLD_ID, WORLDS, getWorldEntry, migrateStateForWorld, resolveWorldForState } from "./worlds/registry";
import { startVeloriaCampaign } from "./worlds/veloria/campaign";
import { NEWBORN_ORIGINS, NEWBORN_ORIGIN_LABELS } from "./worlds/veloria/birthFamily";
import { LifePanel, BirthSetup } from "./ui/LifePanel";
import { capabilities, formatAge, INFANT_ACT_LABELS, NEUTRAL_TEMPERAMENT, type InfantActId } from "./engine/development";
import { dayOfYear, formatClock, yearKLOf } from "./engine/time";
import { describeAttitude } from "./engine/relations";
import { searchChronicle } from "./engine/memory";
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
import { COUNTRIES, REGIONS, MAP_NODES, ROUTES, COUNTRY_SHAPES } from "./worlds/veloria/atlas";
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
const rumorNote = (m: MemoryEntry) => m.kind === "heard" ? ` (слух, ${Math.round(m.confidence * 100)}%)` : "";

function ArdanMap({ current, destination, route }: { current: string; destination: string; route: Array<{from:string;to:string}> }) {
  return <div className="map-shell">
    <svg viewBox="0 0 100 100" role="img" aria-label="Схематическая политическая карта Ардана">
      {COUNTRY_SHAPES.map(shape=>{
        const country=COUNTRIES.find(item=>item.id===shape.countryId);
        return <polygon key={shape.countryId} points={shape.points.map(point=>point.join(",")).join(" ")} className={`country-shape country-${shape.countryId}`}><title>{country?.name ?? shape.countryId}</title></polygon>;
      })}
      {ROUTES.map((edge,i)=>{
        const from=MAP_NODES.find(n=>n.id===edge.from), to=MAP_NODES.find(n=>n.id===edge.to);
        if(!from||!to) return null;
        const selected=route.some(r=>(r.from===edge.from&&r.to===edge.to)||(r.from===edge.to&&r.to===edge.from));
        return <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={selected?"map-route selected":"map-route"}/>;
      })}
      {MAP_NODES.map(node=><g key={node.id} className="map-node">
        <circle cx={node.x} cy={node.y} r={node.id===current?2.5:node.id===destination?2.1:1.4} className={node.id===current?"current":node.id===destination?"destination":""}/>
        <title>{node.name}</title>
        {(node.kind === "capital" || node.id===current || node.id===destination) && <text x={node.x+2} y={node.y-1.5} className="map-label">{node.name}</text>}
      </g>)}
    </svg>
    <div className="map-legend"><span><i className="legend-current"/>Текущее место</span><span><i className="legend-destination"/>Цель</span><span><i className="legend-route"/>Выбранный путь</span></div>
  </div>;
}

export default function App() {
  const [worldId, setWorldId] = useState(DEFAULT_WORLD_ID);
  const [tab, setTab] = useState<Tab>("ПЕРСОНАЖ");
  const [game, setGame] = useState<GameState>(() => createInitialState(getWorldEntry(DEFAULT_WORLD_ID)!.create()));
  const [log, setLog] = useState<string[]>(() => game.playerMemory.map(m => m.text));
  const [action, setAction] = useState("");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<VeloriaCharacterDraft>(() => ({ ...initialDraft, familySeed: createFamilySeed() }));
  const [difficulty, setDifficulty] = useState<WorldDifficultyId>("balanced");
  const [destinationId, setDestinationId] = useState("varentport");
  const [saved, setSaved] = useState(false);
  const [worldDraft, setWorldDraft] = useState({ name:"Новый мир", genre:"Фэнтези", era:"Средневековье", technology:"Ремесленная", magic:"Редкая", description:"" });
  const [saveText, setSaveText] = useState("");
  const [notice, setNotice] = useState("");
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
  const found = useMemo(() => searchChronicle(game, { text: query }), [game, query]);
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
  function liveScene(after: GameState, playerText: string) {
    if (!hasListeners(world, after)) return;
    if (!aiEnabled || aiLimitReached()) {
      if (!sceneHintShown.current) {
        sceneHintShown.current = true;
        setLog(l => [...l, aiEnabled
          ? `Дневной лимит запросов к ИИ (${aiLimit()}) исчерпан, поэтому люди рядом пока молчат. Лимит меняется во вкладке «Система».`
          : "Люди рядом вас слышат. Чтобы они отвечали своими словами, подключите ИИ во вкладке «Система»."]);
      }
      return;
    }
    const envelope = buildSceneEnvelope(buildSceneContext(world, after, playerText, lang), playerText);
    setAiBusy(true);
    makeProxy().writeScene(envelope).then(raw => {
      const scene = coerceScene(raw, envelope.outputContract.speakers);
      if (!scene) return;
      const applied = applyScene(world, after, scene);
      setGame(current => current === after ? applied.state : current);
      setLog(l => [...l, ...applied.lines]);
    }).catch(() => setLog(l => [...l, "ИИ сейчас недоступен, ответы людей не пришли. Мир не изменился."]))
      .finally(() => setAiBusy(false));
  }
  const SOCIAL_INFANT_ACTS: InfantActId[] = ["cry", "smile", "babble", "reach", "cling", "play"];
  function sceneFor(next: import("./engine/types").ActionResult, performed: import("./engine/types").Action, text: string) {
    if (!next.ok || next.state.lifeStatus === "dead") return;
    if (performed.type === "say" || performed.type === "gesture") liveScene(next.state, text);
    else if (performed.type === "infant" && SOCIAL_INFANT_ACTS.includes(performed.act)) liveScene(next.state, `(${INFANT_ACT_LABELS[performed.act]})`);
  }
  function run(text: string) {
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
    setWorldId("veloria"); setGame(result.state); setLog(result.state.playerMemory.map(m => m.text)); setSaved(true);
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
  function switchWorld(id: string, playerName = game.playerName) {
    const entry = getWorldEntry(id); if (!entry) return;
    const next = createInitialState(entry.create(), playerName);
    setWorldId(id); setGame(next); setLog(next.playerMemory.map(m => m.text)); setQuery(""); setNotice("Создана новая сессия в выбранном мире.");
  }
  function exportSave() { setSaveText(JSON.stringify({ schemaVersion:1, worldId, game }, null, 2)); setNotice("Сохранение подготовлено в поле ниже. Скопируй его в файл."); }
  function importSave() {
    const imported = importGamePayload(saveText, WORLDS.map(world => world.id), "demo");
    if (!imported) { setNotice("Не удалось загрузить: формат, версия или выбранный мир сохранения неверны."); return; }
    const migrated = migrateStateForWorld(imported.worldId, imported.game);
    setWorldId(imported.worldId); setGame(migrated); setLog(migrated.playerMemory.map(m => m.text));
    setNotice(imported.sourceFormat === "legacy-branch-save" ? "Старое сохранение движка 0.4 импортировано в демо-мир." : "Сохранение загружено.");
  }

  return <main className="shell">
    <header className="topbar"><div><div className="eyebrow">TEXT ROLEPLAY SIMULATOR</div><h1>LIVING WORLD <span>RPG</span></h1></div><div className="status"><i /> LOCAL ALPHA</div></header>
    <nav className="tabs">{TABS.map(item => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>
    {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}

    {tab === "ИГРА" && <section className="panel">
      <div className="section-head"><div><div className="eyebrow">ТЕКУЩАЯ СЕССИЯ</div><h2>{world.name}</h2></div><div className="clock">{yearKLOf(game.minute, game.worldStartYearKL ?? 742)} KL · день {dayOfYear(game.minute)} года · {formatClock(game.minute)}</div></div>
      <label>Мир<select value={worldId} onChange={e => switchWorld(e.target.value)}>{WORLDS.map(w => <option key={w.id} value={w.id}>{w.name}: {w.subtitle}</option>)}</select></label>
      <div className="location">⌖ {currentSettlementId !== "roven" ? `${currentSettlement?.name ?? currentSettlementId} · ${location.name}` : location.name}</div>
      {game.playerProfile && <div className="profile-strip"><b>{game.playerName}</b> · {game.development ? formatAge(game.development, game.minute) : `${game.playerProfile.age} лет`} · {VELORIA_ORIGIN_LABELS[game.playerProfile.originId as VeloriaOriginId] ?? game.playerProfile.originId} · {PROFESSION_LABELS[game.playerProfile.professionId as VeloriaProfessionId] ?? game.playerProfile.professionId}<br/><span>{game.development ? `${Math.round(game.development.physical.heightCm)} см · ${game.development.physical.weightKg} кг` : `${game.playerProfile.heightCm ? `${game.playerProfile.heightCm} см` : "Рост не указан"} · ${game.playerProfile.weightKg ? `${game.playerProfile.weightKg} кг` : "Вес не указан"}`} · {FAITHS.find(f=>f.id===game.playerProfile?.faithId)?.name ?? "Вера не указана"} · сложность: {WORLD_DIFFICULTIES[game.playerProfile.difficultyId].label}</span>{game.playerProfile.familySummary && <p>{game.playerProfile.familySummary}</p>}</div>}
      {game.development && <LifePanel world={world} game={game} onAct={runAct} onLive={runLive} />}
      {game.playerAppearance && <div className="start-preview"><b>Ваш нынешний облик</b><p>{describeAppearance(game.playerAppearance)}</p></div>}
      {game.socialState && (game.socialState.suspicion > 0 || game.socialState.heresySuspicion > 0) && <div className="warning"><b>Общественная репутация</b><p>Подозрение: {game.socialState.suspicion}/100 · подозрение в ереси: {game.socialState.heresySuspicion}/100 · правовой статус: {({none:"нет дела",watched:"за вами наблюдают",summoned:"вызов на разбирательство",detained:"задержан(а)",condemned:"приговорён(а)",deposed:"свергнут(а)"} as Record<string,string>)[game.socialState.legalCase] ?? game.socialState.legalCase}.</p><p>Попытки создать религиозное движение: {game.socialState.cultAttempts} · реальные сторонники: {(game.socialState.followers?.length ?? 0)}. Стадия: {({none:"нет",rumor:"слухи",sect:"небольшая секта",cult:"устойчивый культ"} as Record<string,string>)[game.socialState.movement] ?? "нет"}.</p></div>}
      {game.lifeStatus === "dead" && <div className="warning"><b>История этого персонажа завершена.</b><p>{game.deathRecord ? `Причина: ${game.deathRecord.cause}. Место: ${MAP_NODES.find(n=>n.id===game.deathRecord?.locationId)?.name ?? game.deathRecord.locationId}.` : "Смерть зафиксирована в сохранении."} Воскресить этого героя нельзя.</p><div className="save-row"><button className="primary" onClick={()=>setTab("ПЕРСОНАЖ")}>СОЗДАТЬ НОВОГО ГЕРОЯ В ЭТОМ МИРЕ</button><button onClick={startNewWorldFromDeath}>НАЧАТЬ НОВУЮ ВЕРСИЮ МИРА</button></div></div>}
      <div className="story">{log.map((line, i) => <p key={i}>{line}</p>)}</div>
      <div className="quick">{quick.map(q => <button key={q} type="button" onClick={() => run(q)}>{q}</button>)}</div>
      <form className="action-form" onSubmit={submitAction}><input value={action} onChange={e => setAction(e.target.value)} placeholder="Что вы хотите сделать?"/><button className="primary">ДЕЙСТВИЕ</button></form>
      <p className="hint">{caps.stage.id === "infancy" ? "Младенец не ходит и не говорит: он плачет, спит, ест, смотрит, улыбается и тянется к близким. Взрослые сами решают, куда его нести. Время удобнее проживать кнопками «Прожить»." : <>Команды: «осмотреться», «инвентарь», «подождать [N мин/часов]», «идти &lt;место&gt;», «купить &lt;товар&gt; [N]», «сказать [реплика]», «показываю [жест]», «прожить [N дней/месяц/год]». Возможности зависят от возраста: длина речи, дальность самостоятельных прогулок и покупки открываются по мере взросления.</>}</p>
    </section>}

    {tab === "ПЕРСОНАЖ" && <section className="panel">
      <div className="section-head"><div><div className="eyebrow">СБОРКА ГЕРОЯ</div><h2>Кем ты войдёшь в Велорию?</h2></div><div className={total === 100 ? "total good" : "total"}>{total} / 100 очков</div></div>
      <h3 className="sub">1. Особая династическая история</h3>
      <label>Стартовая роль<select value={draft.dynasticRole ?? (draft.age === 0 ? "ordinary-birth" : "ordinary")} onChange={e=>{
        if (e.target.value === "ordinary-birth") {
          setDraft(d=>({...d,dynasticRole:undefined,name:d.dynasticRole ? "Новорождённый" : d.name,age:0,originId:NEWBORN_ORIGINS.includes(d.originId)?d.originId:"tenant-farmer",statusId:availableStatuses(NEWBORN_ORIGINS.includes(d.originId)?d.originId:"tenant-farmer")[0]!,professionId:"none",familyState:"together",startScenarioId:"ordinary",heightCm:undefined,weightKg:undefined,skinTone:undefined,hairColor:undefined,hairTexture:undefined,eyeColor:undefined,facialFeatures:undefined}));
          setSaved(false); return;
        }
        const role=e.target.value === "second-prince" ? "second-prince" : undefined;
        setDraft(d=>role ? ({...d,dynasticRole:role,name:"Второй принц Рейнар",age:0,originId:"acknowledged-bastard",statusId:"noble",professionId:"none",familyState:"together",startScenarioId:"ordinary",parentalUnionStatus:"unmarried",heightCm:50,weightKg:3.5,build:"Среднее",hairColor:"light-blond",hairTexture:"straight",eyeColor:"dark-brown",facialFeatures:"east-asian",skinTone:3,hairstyle:"мягкие короткие волосы младенца",biography:"Рождён в 723 КЛ от Гарена Вальда и женщины из далёкой восточной земли. Отец признал сына. Принцесса Элиана (королевой станет в 735 КЛ): жена отца, не мать ребёнка; её личная неприязнь связана с изменой супруга.",familyNotes:"Мать умерла в 725 КЛ; точная причина не установлена. Королевская кормилица Мейра назначена опекуном."}) : ({...d,dynasticRole:undefined,originId:"wanderer",statusId:"marginal",professionId:"none",familyState:"together",parentalUnionStatus:"unknown",age:22,heightCm:170,weightKg:68,build:"Среднее",hairstyle:"",skinTone:undefined,hairColor:undefined,hairTexture:undefined,eyeColor:undefined,facialFeatures:undefined,biography:"",familyNotes:""})); setSaved(false);
      }}><option value="ordinary">Обычный персонаж</option><option value="ordinary-birth">Обычная семья: начать с рождения</option><option value="second-prince">Второй принц дома Рейнар: начать с рождения</option></select></label>
      {draft.dynasticRole === "second-prince" && <div className="start-preview"><b>Канонический сценарий · 723 КЛ</b><p>Ты начинаешь жизнь новорождённым во дворце Коронхольма. Гарен Вальд: твой биологический отец; мать: куртизанка из далёкой восточной земли. Элиана III: жена отца, не твоя мать. Она ненавидит напоминание об измене и обращается с тобой холодно, хотя обязана соблюдать королевский протокол.</p><p>Кронпринц Альдрен уже родился и остаётся первым наследником. Третья принцесса Марен родится в 724 КЛ, Элиза: в 726 КЛ, Орен: в 727 КЛ.</p><p><b>Твоя внешность фиксирована:</b> светлая кожа, светло-русые волосы, почти чёрные карие глаза и выраженные восточноазиатские черты лица. Интеллект, задатки, темперамент, телосложение и дальнейшее развитие задаются анкетой.</p></div>}
      <h3 className="sub">2. Социальная роль и происхождение</h3>
      <div className="form-grid">
        <label>Имя персонажа<input maxLength={40} value={draft.name} onChange={e => patchDraft("name", e.target.value)}/></label>
        <label>Возраст (0–80)<input type="number" min={0} max={80} value={draft.age} disabled={draft.dynasticRole === "second-prince"} onChange={e => { const age=Number(e.target.value); setDraft(d=>({...d,age,skinTone:undefined,hairColor:undefined,hairTexture:undefined,eyeColor:undefined,facialFeatures:undefined,professionId:age<16?"none":d.professionId,heightCm:age<5?Math.round(50+age*12):age<12?Math.round(105+(age-5)*7):age<16?Math.round(154+(age-12)*7):d.heightCm,weightKg:age<5?Math.round((3.5+age*3)*10)/10:age<12?Math.round((20+(age-5)*4)*10)/10:age<16?Math.round(48+(age-12)*8):d.weightKg})); setSaved(false); }}/></label>
        <label>Происхождение<select value={draft.originId} disabled={draft.dynasticRole === "second-prince"} onChange={e => { const originId=e.target.value as VeloriaOriginId; const nextStatus=availableStatuses(originId)[0]; const nextProf=nextStatus ? availableProfessions(originId,nextStatus)[0] : "none"; const nextScenario=availableScenarios(originId)[0] ?? "ordinary"; setDraft(d=>({...d,originId,statusId:nextStatus,professionId:nextProf,startScenarioId:nextScenario,familyState:originId==="temple-orphan" && !["unknown","chosen-family"].includes(d.familyState) ? "unknown" : d.familyState,parentalUnionStatus:originId==="temple-orphan" ? "unknown" : d.parentalUnionStatus,skinTone:undefined,hairColor:undefined,hairTexture:undefined,eyeColor:undefined,facialFeatures:undefined})); setSaved(false); }}>{ORIGINS.map(id=>{const newborn = draft.age === 0 && draft.dynasticRole !== "second-prince";const blocked=(["minor-heir","noble-younger","acknowledged-bastard","impoverished-noble"].includes(id) && !(draft.dynasticRole === "second-prince" && id === "acknowledged-bastard")) || (newborn && !NEWBORN_ORIGINS.includes(id));return <option key={id} value={id} disabled={blocked}>{newborn ? NEWBORN_ORIGIN_LABELS[id] ?? VELORIA_ORIGIN_LABELS[id] : VELORIA_ORIGIN_LABELS[id]}{blocked?" (пока недоступно)":""}</option>;})}</select></label>
        <label>Общественное положение<select value={draft.statusId} disabled={draft.dynasticRole === "second-prince"} onChange={e => { const statusId=e.target.value as VeloriaStatusId; const nextProf=availableProfessions(draft.originId,statusId)[0] ?? "none"; patchDraft("statusId",statusId); setDraft(d=>({...d,statusId,professionId:nextProf})); }}>{statuses.map(id=><option key={id} value={id}>{STATUS_LABELS[id]}</option>)}</select></label>
{!isBirthStart &&         <label>Профессия<select value={draft.professionId} disabled={draft.dynasticRole === "second-prince"} onChange={e => patchDraft("professionId",e.target.value as VeloriaProfessionId)}>{(draft.age<16?["none"]:professions).map(id=><option key={id} value={id}>{draft.age<16?"Ребёнок / без взрослой профессии":PROFESSION_LABELS[id as VeloriaProfessionId]}</option>)}</select></label>}
        <label>Семья<select value={draft.familyState} disabled={draft.dynasticRole === "second-prince"} onChange={e => { const familyState=e.target.value as VeloriaFamilyState; setDraft(d=>({...d,familyState,parentalUnionStatus:["together","distant","lost"].includes(familyState)?d.parentalUnionStatus:"unknown",skinTone:undefined,hairColor:undefined,hairTexture:undefined,eyeColor:undefined,facialFeatures:undefined})); setSaved(false); }}>{Object.entries(FAMILY_LABELS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
        <label>Начальная ситуация<select value={draft.startScenarioId} disabled={draft.dynasticRole === "second-prince"} onChange={e => patchDraft("startScenarioId",e.target.value as VeloriaStartScenario)}>{scenarios.map(id=><option key={id} value={id}>{SCENARIO_LABELS[id]}</option>)}</select></label>
        <label>Сложность мира<select value={difficulty} onChange={e=>{setDifficulty(e.target.value as WorldDifficultyId);setSaved(false);}}>{Object.values(WORLD_DIFFICULTIES).map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select></label>
      </div>
      <p className="hint">{WORLD_DIFFICULTIES[difficulty].description} Выбранный пресет сохраняется в анкете; его числовые модификаторы пока не влияют на симуляцию. Детский персонаж может начать жизнь с рождения: до пяти лет он не говорит связно, но может действовать невербально; взрослые обычно не воспринимают детские заявления как серьёзную проповедь.</p>
      <label>Биография<textarea maxLength={2000} rows={4} value={draft.biography} onChange={e=>patchDraft("biography",e.target.value)} placeholder="Прошлое персонажа, важные события, долги, связи, страхи и личные цели…"/></label>
      <h3 className="sub">3. Семья и родители</h3>
      <div className="start-preview">
        <b>Семья, назначенная миром</b>
        {familyAssignment.available ? <>
          <p>{familyAssignment.summary}</p>
          {familyAssignment.household && <div className="save-row"><button type="button" onClick={()=>{ setDraft(d=>({...d,familySeed:createFamilySeed()})); setSaved(false); }}>ДРУГАЯ СЕМЬЯ</button></div>}
          {familyAssignment.members.length > 0 && <ul>{familyAssignment.members.map(member=><li key={member.id}><b>{member.name}</b> · {member.age} лет · {familyMemberLabel(member)}{member.lifeStatus === "missing" ? " · пропал(а), судьба неизвестна" : member.lifeStatus === "dead" ? " · умер(ла)" : ""}{member.appearance && <small className="muted">{describeAppearance(member.appearance)}</small>}</li>)}</ul>}
          {draft.dynasticRole === "second-prince" ? <p>Гарен признал отцовство. Королевская грамота включает тебя вторым после кронпринца; юридическое основание записано отдельно от личного отношения королевы.</p> : familyAssignment.biologicalParents.length === 2 ? <p>Юридическое родительство и признание не предполагаются автоматически. Право наследования остаётся неопределённым, пока закон и документы не установлены.</p> : <p>Опекуны не считаются биологическими или юридическими родителями без отдельной записи; усыновление не предполагается автоматически.</p>}
        </> : <p>{familyAssignment.reason}</p>}
        {(draft.originId === "minor-heir" || draft.originId === "noble-younger" || draft.originId === "impoverished-noble") && <p><b>Справка по канону:</b> {dynasticHeirOptions.slice(0, 8).map(item => item.houseName).join(" · ")}. Это существующие династии, а не список родителей для выбора.</p>}
        {draft.originId === "acknowledged-bastard" && draft.dynasticRole !== "second-prince" && <p>В текущем реестре подтверждённых признанных бастардов: {acknowledgedBastards.length}. Для этого сценария сначала нужно согласовать реальных биологических родителей и запись о признании.</p>}
        {familyAssignment.biologicalParents.length === 2 && draft.dynasticRole !== "second-prince" && <label>Брачный статус родителей при твоём рождении<select value={draft.parentalUnionStatus ?? "unknown"} onChange={e=>patchDraft("parentalUnionStatus",e.target.value as VeloriaCharacterDraft["parentalUnionStatus"])}><option value="unknown">Неизвестно</option><option value="married">Состояли в браке</option><option value="unmarried">Не состояли в браке</option></select></label>}
        <p>Биологические родители, юридические родители и опекуны: отдельные связи. Брак сам по себе не подменяет юридическое признание и право наследования.</p>
      </div>
      <label>Личные заметки о семье<textarea maxLength={500} rows={2} value={draft.familyNotes ?? ""} onChange={e=>patchDraft("familyNotes",e.target.value)} placeholder="Семейные обязанности, конфликты, долги и секреты…"/></label>
      <p className="hint">Личные заметки не создают новых родителей, опекунов или родственных связей. Их назначает семейная система.</p>
      <h3 className="sub">4. Наследуемая внешность и личность</h3>
      <div className="form-grid">
{!isBirthStart && <>        <label>Рост (см)<input type="number" min={draft.age<5?40:draft.age<12?70:draft.age<16?110:140} max={draft.age<5?125:draft.age<12?165:draft.age<16?200:205} value={draft.heightCm ?? 170} onChange={e=>patchDraft("heightCm",Number(e.target.value))}/></label>
        <label>Вес (кг)<input type="number" min={draft.age<5?2:draft.age<12?8:draft.age<16?25:40} max={draft.age<5?30:draft.age<12?70:draft.age<16?110:140} step={0.5} value={draft.weightKg ?? 68} onChange={e=>patchDraft("weightKg",Number(e.target.value))}/></label>
        <label>Телосложение<select value={draft.build ?? "Среднее"} onChange={e=>patchDraft("build",e.target.value)}><option>Худощавое</option><option>Среднее</option><option>Плотное</option><option>Крепкое</option><option>Спортивное</option></select></label></>}
        {draft.dynasticRole === "second-prince" ? <p className="hint">Внешность второго принца закреплена каноном: светлая кожа, светло-русые волосы, прямые волосы, тёмно-карие глаза и восточноазиатские черты лица. Изменить её нельзя.</p> : inheritedOptions && selectedInheritedAppearance ? <>
          <label>Тон кожи (наследуемый)<select value={selectedInheritedAppearance.skinTone} onChange={e=>patchDraft("skinTone",Number(e.target.value) as VeloriaCharacterDraft["skinTone"])}>{Array.from({length: inheritedOptions.skinMax - inheritedOptions.skinMin + 1},(_,i)=>inheritedOptions.skinMin+i).map(tone=><option key={tone} value={tone}>{tone} / 10</option>)}</select></label>
          <label>Природный цвет волос<select value={selectedInheritedAppearance.hairColor} onChange={e=>patchDraft("hairColor",e.target.value as VeloriaCharacterDraft["hairColor"])}>{inheritedOptions.hairColors.map(value=><option key={value} value={value}>{({black:"чёрный", "dark-brown":"тёмно-каштановый", brown:"каштановый", auburn:"рыжевато-каштановый", red:"рыжий", blond:"русый", "light-blond":"светло-русый", grey:"седой", white:"белый"} as Record<string,string>)[value]}</option>)}</select></label>
          <label>Текстура волос<select value={selectedInheritedAppearance.hairTexture} onChange={e=>patchDraft("hairTexture",e.target.value as VeloriaCharacterDraft["hairTexture"])}>{inheritedOptions.hairTextures.map(value=><option key={value} value={value}>{({straight:"прямые",wavy:"волнистые",curly:"кудрявые",coiled:"очень кудрявые"} as Record<string,string>)[value]}</option>)}</select></label>
          <label>Цвет глаз<select value={selectedInheritedAppearance.eyeColor} onChange={e=>patchDraft("eyeColor",e.target.value as VeloriaCharacterDraft["eyeColor"])}>{inheritedOptions.eyeColors.map(value=><option key={value} value={value}>{({brown:"карие", "dark-brown":"тёмно-карие",hazel:"ореховые",green:"зелёные",blue:"голубые",grey:"серые",amber:"янтарные"} as Record<string,string>)[value]}</option>)}</select></label>
          <label>Черты лица<select value={selectedInheritedAppearance.facialFeatures} onChange={e=>patchDraft("facialFeatures",e.target.value as VeloriaCharacterDraft["facialFeatures"])}>{inheritedOptions.facialFeatures.map(value=><option key={value} value={value}>{({soft:"мягкие",angular:"угловатые",broad:"широкие",narrow:"узкие",mixed:"сочетание черт обоих родителей"} as Record<string,string>)[value]}</option>)}</select></label>
        </> : <p className="hint">Наследуемые признаки нельзя выбрать без двух известных биологических родителей. При неизвестном происхождении поля останутся неопределёнными, а не станут свободным выбором.</p>}
{!isBirthStart &&         <label>Причёска сейчас<input maxLength={80} value={draft.hairstyle ?? ""} onChange={e=>patchDraft("hairstyle",e.target.value)} placeholder="Например: длинные волосы до плеч (без указания цвета)"/></label>}
        <label>Вера<select value={draft.faithId ?? "sevenfold"} onChange={e=>patchDraft("faithId",e.target.value)}><option value="none">Не придерживается / неизвестно</option>{FAITHS.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
{!isBirthStart &&         <label>Образование<input maxLength={300} value={draft.education ?? ""} onChange={e=>patchDraft("education",e.target.value)} placeholder="Грамота, ученичество, наставник…"/></label>}
      </div>
{!isBirthStart &&       <label>Отметины и особенности тела<textarea maxLength={600} rows={2} value={draft.appearance ?? ""} onChange={e=>patchDraft("appearance",e.target.value)} placeholder="Осанка, родинка, родимое пятно, веснушки; без цвета кожи, глаз, волос и формы лица…"/></label>}
      {!isNonInheritedAppearanceDescriptionAllowed(draft.appearance ?? "") && <div className="warning">Это поле не может задавать наследуемые признаки: они определяются по биологическим родителям.</div>}
      {familyErrors.length > 0 && <div className="warning">{familyErrors.map((issue,i)=><div key={i}>{issue.message}</div>)}</div>}
      {appearanceErrors.length > 0 && <div className="warning">{appearanceErrors.map((error,i)=><div key={i}>{error}</div>)}</div>}
      {isBirthStart ? <><h3 className="sub">Врождённый темперамент и телосложение</h3>
        <BirthSetup temperament={{ ...NEUTRAL_TEMPERAMENT, ...(draft.temperament ?? {}) }} build={draft.bodyBuild ?? "average"} heightTendency={draft.heightTendency ?? "average"}
          onChange={patch => { setDraft(d => ({ ...d, ...(patch.temperament ? { temperament: patch.temperament } : {}), ...(patch.build ? { bodyBuild: patch.build } : {}), ...(patch.heightTendency ? { heightTendency: patch.heightTendency } : {}) })); setSaved(false); }} /></>
      : <>      <label>Характер<textarea maxLength={600} rows={2} value={draft.personality ?? ""} onChange={e=>patchDraft("personality",e.target.value)} placeholder="Темперамент, привычки, сильные и слабые стороны…"/></label>
      <label>Навыки<textarea maxLength={500} rows={2} value={draft.skills ?? ""} onChange={e=>patchDraft("skills",e.target.value)} placeholder="Что умеет делать; навыки не дают автоматического превосходства…"/></label></>}
      <h3 className="sub">Характеристики</h3><p className="hint">{draft.dynasticRole === "second-prince" ? "Распредели 100 очков задатков и потенциала. Это не умения новорождённого: способности будут развиваться с возрастом, воспитанием и опытом." : "Распредели ровно 100 очков. Диапазон каждой характеристики: от 1 до 30. Сверхчеловеческие значения недоступны."}</p>
      <div className="stats">{ATTRIBUTE_NAMES.map(name=><div className="stat" key={name}><label>{name}<b>{draft.attributes[name]}</b></label><input type="range" min={1} max={30} value={draft.attributes[name]} onChange={e=>updateAttribute(name,Number(e.target.value))}/></div>)}</div>
      {validation.ok ? <div className="start-preview"><b>{draft.dynasticRole === "second-prince" ? "Стартовая точка: королевская детская Коронхольма" : "Стартовая точка: Ровен"}</b><p>{validation.start.notes.join(" ")}</p><small>Деньги: {validation.start.money} · Стартовая локация: {veloriaWorld.locations[validation.start.locationId]?.name ?? validation.start.locationId}</small></div> : <div className="warning">{validation.errors.map((error,i)=><div key={i}>{error}</div>)}</div>}
      <div className="save-row"><button className="primary" disabled={!validation.ok || !familyAssignment.available || familyErrors.length > 0 || appearanceErrors.length > 0} onClick={createCharacter}>СОЗДАТЬ ПЕРСОНАЖА И НАЧАТЬ</button>{saved&&<span className="saved">✓ Персонаж создан</span>}</div>
    </section>}

    {tab === "ДОРОГА" && <section className="panel"><div className="eyebrow">ГЛОБАЛЬНАЯ КАРТА</div><h2>Путешествие по Ардану</h2>
      <div className="location">Сейчас: {currentSettlement?.name ?? currentSettlementId}{game.journey ? " · в пути" : ""}</div>
      <ArdanMap current={currentSettlementId} destination={game.journey?.destinationId ?? destinationId} route={game.journey?.route ?? selectedRoute?.segments ?? []}/>
      {game.journey ? <div className="journey-card"><b>Маршрут до {MAP_NODES.find(n=>n.id===game.journey!.destinationId)?.name ?? game.journey.destinationId}</b><p>Сейчас: {MAP_NODES.find(n=>n.id===game.journey!.route[game.journey!.segmentIndex]?.from)?.name ?? game.journey.route[game.journey.segmentIndex]?.from} → {MAP_NODES.find(n=>n.id===game.journey!.route[game.journey!.segmentIndex]?.to)?.name ?? game.journey.route[game.journey.segmentIndex]?.to}</p><p>Участок {game.journey.segmentIndex+1} из {game.journey.route.length}. Осталось дней на участке: <strong>{game.journey.daysRemaining}</strong>. В пути: {game.journey.elapsedDays} дн.</p><p className="hint">Время продвигается по одному дню за действие. При достижении промежуточного пункта обновляется положение героя.</p><button className="primary" onClick={advanceJourney}>ПРОДВИНУТЬСЯ НА ОДИН ДЕНЬ</button></div> : <>
        <label>Куда отправиться<select value={destinationId} onChange={e=>setDestinationId(e.target.value)}>{MAP_NODES.filter(node=>node.id!==currentSettlementId).map(node=><option key={node.id} value={node.id}>{node.name}, {COUNTRIES.find(c=>c.id===node.countryId)?.name}</option>)}</select></label>
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

    {tab === "ПАМЯТЬ" && <section className="panel"><div className="eyebrow">ХРОНИКА И ЗНАНИЯ</div><h2>Память мира</h2><h3 className="sub">Объективная хроника</h3><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по хронике…"/>{found.length?<ul className="memory">{found.map(c=><li key={c.id}><span>{formatClock(c.minute)}</span>{c.text}</li>)}</ul>:<div className="placeholder">{game.chronicle.length?"Ничего не найдено.":"Событий пока нет."}</div>}
      <h3 className="sub">Память игрока</h3><ul className="memory">{game.playerMemory.map((m,i)=><li key={i}><span>{formatClock(m.minute)}</span>{m.text}</li>)}</ul><h3 className="sub">Память NPC</h3>{Object.values(world.npcs).map(npc=><div key={npc.id}><b className="npc">{npc.name}</b><p className="muted">Отношение к игроку: {describeAttitude(game.relations[npc.id]!)}</p>{(game.npcMemory[npc.id]??[]).length?<ul className="memory">{game.npcMemory[npc.id]!.map((m,i)=><li key={i}><span>{formatClock(m.minute)}</span>{m.text}{rumorNote(m)}</li>)}</ul>:<p className="muted">Пока нет воспоминаний.</p>}</div>)}</section>}

    {tab === "СИСТЕМА" && <section className="panel"><div className="eyebrow">СИСТЕМА</div><h2>Сохранение и состояние проекта</h2><div className="save-row"><button onClick={exportSave}>ПОДГОТОВИТЬ СОХРАНЕНИЕ</button><button onClick={importSave}>ЗАГРУЗИТЬ ИЗ ПОЛЯ</button></div><label>JSON сохранения<textarea rows={12} value={saveText} onChange={e=>setSaveText(e.target.value)} placeholder="Нажми «Подготовить сохранение» или вставь JSON сюда…"/></label>
      <AiSettings lang={lang} onLang={value => { setLang(value); writePref("openworld.lang", value); }} session={keySession} endpoint={aiEndpoint} onEndpoint={value => { setAiEndpoint(value); writePref("openworld.ai.endpoint", value); }} enabled={aiEnabled} onEnabled={value => { setAiEnabled(value); writePref("openworld.ai.enabled", String(value)); }} provider={aiProvider} onProvider={value => { setAiProvider(value); writePref("openworld.ai.provider", value); }} model={aiModel} onModel={value => { setAiModel(value); writePref("openworld.ai.model", value); }} onChange={() => setKeyTick(n => n + 1)} />
      <div className="warning">Реестры скрытых фигур и культов пока лежат в открытых исходниках; в публичном GitHub они не являются секретными. Для настоящей тайны потребуется приватный backend.</div>
      <ul className="checklist"><li>✓ Велорийский конструктор персонажа подключён к игровому состоянию</li><li>✓ Ровен: единственная стартовая точка первой кампании</li><li>✓ Происхождение, статус, профессия, семья и сценарий валидируются</li><li>✓ Сложность выбирается до начала кампании и не масштабируется автоматически</li><li>✓ Сохранение/загрузка JSON в интерфейсе</li><li>✓ Хроника, память NPC и отношения отображаются в интерфейсе</li><li>✓ Межгородские путешествия: дни пути, промежуточные поселения и запись в хронику</li><li>✓ NPC в Ровене учитывают время пешего перехода между точками расписания</li><li>✓ После зафиксированной смерти доступны преемник в продолжающемся мире или новая версия мира</li><li>○ Уличные карты остальных городов, глобальное перемещение NPC и самостоятельные решения</li><li>✓ Естественное старение героя от прошедшего игрового времени</li><li>○ Болезни, лечение, травмы и автоматические причины смерти</li><li>✓ Живые ответы NPC через нейросеть: свой голос по возрасту, характеру, сословию и краю, память о разговоре</li><li>○ Правосудие и самостоятельные действия NPC</li><li>○ Серверное хранение секретов и ИИ-посредник</li></ul>
    </section>}
    <footer>LIVING WORLD RPG <span>· 0.15.0 · локальная альфа</span></footer>
  </main>;
}
