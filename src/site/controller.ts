/**
 * Сайт = макет Жозы (index.html). Этот модуль оживляет экраны приложения движком игры:
 * вход, возраст, создание героя, ходы, карта, память, сохранения, ИИ. Разметку не меняет,
 * только заполняет те же блоки, что заполнял макет, настоящими данными.
 */
import type { Session } from "@supabase/supabase-js";
import landSvg from "../ui/assets/ardan-land.svg.txt?raw";
import { applyAction } from "../engine/rules";
import { parseAction } from "../engine/parse";
import { resolveWithAi } from "../engine/ai";
import { understandFreeText } from "../engine/intent";
import { applyScene, buildSceneContext, buildSceneEnvelope, coerceScene, hasListeners, isNarrationPerson, type NarrationPerson, type SceneEvent } from "../engine/speech";
import { ageFromBirthDate, isChildSafetyViolation, localSafetyStore, registerViolation } from "../engine/safety";
import { capabilities, formatAge, INFANT_ACT_LABELS, LIFE_STAGES, type InfantActId } from "../engine/development";
import { dayOfYear, hourOf, yearKLOf } from "../engine/time";
import { npcActivity, npcsAt } from "../engine/world";
import { knownPeople, ageText } from "../engine/acquaintances";
import { importGamePayload } from "../engine/save";
import { buryIfDead, loadBlockedByDeath, loadGraveyard, mergeGraveyards, newLifeId, saveGraveyard } from "../engine/permadeath";
import type { Action, ActionResult, GameState, WorldData } from "../engine/types";
import { WORLDS, getWorldEntry, migrateStateForWorld, resolveWorldForState } from "../worlds/registry";
import { startVeloriaCampaign } from "../worlds/veloria/campaign";
import { BIRTH_GROUPS, BIRTH_ORIGINS, BIRTH_STATES, birthOrigin, type BirthOrigin } from "../worlds/veloria/birthOrigins";
import { SECOND_PRINCE_START_YEAR } from "../worlds/veloria/reynarCourt";
import { generateVeloriaFamily } from "../worlds/veloria/familyGeneration";
import { kinOptions, lookFromLine, regionOptions, type KinMember, type KinMark } from "../worlds/veloria/kin";
import { COUNTRIES, MAP_NODES, REGIONS } from "../worlds/veloria/atlas";
import { knownSettlementIds } from "../worlds/veloria/mapLayer";
import { AREA_LORE, placeStory } from "../worlds/veloria/placeLore";
import { travelOptions } from "../worlds/veloria/travel";
import { FAITHS } from "../worlds/veloria/faiths";
import { newLifeAttributes, NEW_LIFE_ATTRIBUTES, type VeloriaCharacterDraft } from "../worlds/veloria/character";
import type { WorldDifficultyId } from "../worlds/veloria/difficulty";
import { draftForOrigin } from "../ui/NewLifeWizard";
import { readAutosave, writeAutosave } from "../ui/autosave";
import { AUTO_SLOT, GRAVEYARD_SLOT, GRAVEYARD_WORLD, fetchProfile, getCloud, getCloudKey, getCloudSave, putCloudKey, putCloudSave, reportChildSafetyStrike, saveAdultMode, saveBirthDate, signInWithGoogle, signOut, type Profile } from "../cloud/account";
import { UnlockedKeySession, decryptApiKey, encryptApiKey, loadVaultRecord, saveVaultRecord } from "../ai/keyVault";
import { hasPin, isValidPin, pinTriesLeft, savePin, unlockWithPin } from "../ai/pinVault";
import { DirectAi, DEFAULT_MODEL, AiError, callModel } from "../ai/directClient";
import { isAiProviderId, type AiProviderId } from "../ai/proxyClient";
import { CachingProposer } from "../ai/intentCache";
import { recordUsage } from "../ai/usage";

type Draft = VeloriaCharacterDraft;
const $ = (id: string) => document.getElementById(id) as HTMLElement;
const qa = (root: ParentNode, sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel));
const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]!));
const pref = (k: string, d = "") => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const setPref = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* нет хранилища */ } };
const yrs = (n: number) => { const a = n % 10, b = n % 100; return `${n} ${a === 1 && b !== 11 ? "год" : a >= 2 && a <= 4 && (b < 12 || b > 14) ? "года" : "лет"}`; };
const cap = (t: string) => t ? t.charAt(0).toLocaleUpperCase("ru") + t.slice(1) : t;
const MON = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const season = (m: number) => { const d = dayOfYear(m); return d <= 59 || d > 334 ? "зима" : d <= 151 ? "весна" : d <= 243 ? "лето" : "осень"; };
const partOfDay = (m: number) => { const h = hourOf(m); return h < 5 ? "ночь" : h < 11 ? "утро" : h < 17 ? "день" : h < 22 ? "вечер" : "ночь"; };

// ===================== состояние =====================
const WORLD_ID = "veloria";
const cloud = getCloud();
let session: Session | null = null, profile: Profile | null = null;
let birthDate = pref("openworld.birthdate");
let adult = pref("openworld.adult-content") === "true";
let person: NarrationPerson = (v => isNarrationPerson(v) ? v : "2")(pref("openworld.narration-person", "2"));
let lang: "ru" | "en" = pref("openworld.lang", "ru") === "en" ? "en" : "ru";
let game: GameState | null = null;
let log: string[] = [];
let busy = false;
let graveyard = loadGraveyard();
const keys = new UnlockedKeySession();
let aiModel = pref("openworld.ai.model");
const localSafety = localSafetyStore();
let safety = localSafety.load();
const seed = () => (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
let draft: Draft = freshDraft();
let line = 50;
let first = true;
let stack: string[] = [];

function freshDraft(): Draft {
  const base = { name: "", age: 7, originId: "wanderer", statusId: "marginal", professionId: "none", familyState: "together", startScenarioId: "ordinary", biography: "", appearance: "", hair: "", hairstyle: "", eyes: "", personality: "", education: "", faithId: "sevenfold", skills: "", familyNotes: "", attributes: newLifeAttributes(Object.fromEntries(NEW_LIFE_ATTRIBUTES.map(a => [a, 3]))) } as unknown as Draft;
  return { ...draftForOrigin(base, BIRTH_ORIGINS[0]!), familySeed: seed() };
}
const world = (): WorldData => (game && resolveWorldForState(WORLD_ID, game.campaign)) ?? getWorldEntry(WORLD_ID)!.create();
const alive = () => !!game?.playerProfile && game.lifeStatus !== "dead";
const aiOn = () => keys.isUnlocked;
const locked = () => !keys.isUnlocked && hasPin();
const adultAllowed = () => (ageFromBirthDate(birthDate) ?? 0) >= 18;

// ===================== навигация (как в макете) =====================
let app: HTMLElement, site: HTMLElement;
function show(id: string) {
  qa(app, ".scr").forEach(s => s.classList.toggle("on", s.id === id));
  qa($(id), ".body,.page").forEach(b => { b.scrollTop = 0; });
  render[id]?.();
}
function go(id: string) { stack.push(id); show(id); }
function reset(id: string) { stack = [id]; show(id); }
function back() { if (stack.length > 1) { stack.pop(); show(stack[stack.length - 1]!); } }
function login() {
  site.hidden = true; app.hidden = false; document.body.style.overflow = "hidden";
  if (!birthDate || ageFromBirthDate(birthDate) === null) reset("ageS");
  else if (alive()) reset("menuS");
  else { first = !game; startWizard(); }
}
function logout() {
  app.hidden = true; site.hidden = false; document.body.style.overflow = ""; if (location.hash) location.hash = ""; window.scrollTo(0, 0);
}
function startWizard() { draft = freshDraft(); line = 50; ($("nm") as HTMLInputElement).dataset.touched = ""; stack = alive() || !first ? ["menuS"] : []; go("w1"); }

// ===================== возраст игрока =====================
function ageCalc() {
  const m = +($("bm") as HTMLSelectElement).value || 1, y = +($("by") as HTMLSelectElement).value || 2000;
  const iso = `${y}-${String(m).padStart(2, "0")}-01`;
  const n = Math.max(0, ageFromBirthDate(iso) ?? 0);
  $("ageNow").textContent = `Тебе ${yrs(n)}`; $("ageBorn").textContent = `${MON[m - 1]} ${y}`;
  $("ageNoteT").textContent = n < 18 ? "Тебе меньше 18, поэтому откровенных сцен не будет. Всё остальное открыто." : "Откровенные сцены можно включить в настройках, они только для 18+.";
  return iso;
}
function confirmAge() {
  birthDate = ageCalc(); setPref("openworld.birthdate", birthDate);
  if (cloud && profile && !profile.birthDate) void saveBirthDate(cloud, profile.id, birthDate).then(() => { if (profile) profile = { ...profile, birthDate }; }).catch(() => undefined);
  if (alive()) reset("menuS"); else { first = true; startWizard(); }
}

// ===================== мастер =====================
const origin = (): BirthOrigin => birthOrigin(draft.birthOriginId) ?? BIRTH_ORIGINS[0]!;
const family = () => generateVeloriaFamily(draft);
const ICO: Record<string, string> = {
  "земля": '<svg class="i" viewBox="0 0 24 24"><path d="M4 20c4-1 12-1 16 0"/><path d="M12 20V9M12 13c-2.5 0-4-2-4-4 2.5 0 4 2 4 4zM12 11c2.5 0 4-2 4-4-2.5 0-4 2-4 4z"/></svg>',
  "ремесло": '<svg class="i" viewBox="0 0 24 24"><path d="M14 4l6 6-3 3-6-6z"/><path d="M11 7L4 14a2 2 0 0 0 3 3l7-7"/></svg>',
  "торговля": '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.5c0-1.2 1.1-2 2.5-2s2.5.6 2.5 1.7c0 2.6-5 1.5-5 4 0 1 1.1 1.8 2.5 1.8s2.5-.8 2.5-2"/></svg>',
  "служба": '<svg class="i" viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2"/></svg>',
  "храм": '<svg class="i" viewBox="0 0 24 24"><path d="M4 9l8-5 8 5"/><path d="M6 9v9M10 9v9M14 9v9M18 9v9M4 20h16"/></svg>',
  "дно": '<svg class="i" viewBox="0 0 24 24"><path d="M5 20V9l4-3v14M15 20V6l4 3v11M9 20h6"/></svg>',
  "малый дом": '<svg class="i" viewBox="0 0 24 24"><path d="M5 20V10l7-5 7 5v10"/><path d="M10 20v-5h4v5"/></svg>',
  "королевский дом": '<svg class="i" viewBox="0 0 24 24"><path d="M4 17l2-9 4 4 2-6 2 6 4-4 2 9z"/><path d="M4 20h16"/></svg>'
};
const ICO_O = '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/></svg>';
function renderStates() {
  const o = origin(), st = BIRTH_STATES.find(s => s.id === o.stateId)!, country = COUNTRIES.find(c => c.id === st.id);
  $("states").innerHTML = BIRTH_STATES.map(s => `<button class="chip" type="button" aria-pressed="${s.id === st.id}" data-st="${s.id}">${esc(s.name)}</button>`).join("");
  const faith = FAITHS.find(f => f.id === country?.primaryFaith)?.name;
  const facts = [`славится: ${st.knownFor.split(".")[0]!.toLocaleLowerCase("ru")}`, country?.ruler ? `правит: ${country.ruler}` : "", faith ? `вера: ${faith}` : ""].filter(Boolean);
  $("sinfo").innerHTML = `<b>${esc(country?.name ?? st.name)}</b><p>${esc(`${st.climate}. ${st.blurb}`)}</p><div class="facts2">${facts.map(f => `<span>${esc(f)}</span>`).join("")}</div>`;
  let h = "";
  BIRTH_GROUPS.forEach(g => {
    const list = BIRTH_ORIGINS.filter(x => x.stateId === st.id && x.group === g);
    if (!list.length) return;
    h += `<span class="lbl">${esc(cap(g))}</span>`;
    list.forEach(x => { h += `<button class="opt" type="button" data-o="${x.id}" aria-pressed="${x.id === o.id}"><span class="oi">${ICO[g] ?? ICO_O}</span><span><b>${esc(x.label)}</b><span>${esc(x.blurb)}</span><em class="meta">${x.wealthHint === "бедно" ? "обычно бедно" : x.wealthHint === "скромно" ? "обычно скромно" : "обычно в достатке"}</em></span></button>`; });
  });
  $("origins").innerHTML = h;
  qa($("sex"), "button").forEach(b => { b.setAttribute("aria-pressed", String((b.textContent!.trim() === "Девочка") === (draft.sex === "female"))); (b as HTMLButtonElement).disabled = !!o.fixed; });
}
function chooseOrigin(o: BirthOrigin) { draft = { ...draftForOrigin(draft, o), familySeed: draft.familySeed }; line = 50; }
function renderFamily() {
  const f = family(), p = f.preview;
  $("famLead").textContent = (o => o.fixed ? f.summary : p?.summary ?? "")(origin());
  const fm = (name: string, em: string, text: string) => `<div class="fm"><div><b>${esc(name)} <em>${esc(em)}</em></b><span>${esc(text)}</span></div></div>`;
  $("famList").innerHTML = (p?.members ?? []).map(m => fm(`${m.name}, ${m.role}`, m.alive ? yrs(m.age) : "", m.alive ? `${m.temperament}. ${m.appearance} ${cap(m.occupation)}.${m.from ? ` Родом из ${m.from}.` : ""}${m.livesWithYou ? "" : " Живёт отдельно."}` : "")).join("");
  const friends = p?.friends ?? [];
  $("famFriends").hidden = !friends.length;
  $("famFriends").innerHTML = `<span class="lbl">Друзья и соседи</span>${friends.map(m => fm(m.name, yrs(m.age), `${m.temperament}. ${m.appearance}${m.from ? ` Семья родом из ${m.from}.` : ""}`)).join("")}`;
}

// Внешность: только черты родных (мама, папа, бабушки, деды). Подкидыш: обычные черты края.
type LookKey = "skinTone" | "hairColor" | "hairTexture" | "eyeColor" | "facialFeatures" | "nose" | "lips" | "brows" | "heightTendency" | "bodyBuild";
const W: Record<LookKey, Record<string, string>> = {
  skinTone: Object.fromEntries(["очень светлая", "светлая", "светлая, тёплая", "золотистая", "оливковая", "смугловатая", "смуглая", "бронзовая", "тёмная", "очень тёмная"].map((w, i) => [String(i + 1), w])),
  hairColor: { black: "чёрные", "dark-brown": "тёмно-каштановые", brown: "каштановые", auburn: "рыжевато-каштановые", red: "рыжие", blond: "русые", "light-blond": "светло-русые", grey: "седые", white: "белые" },
  hairTexture: { straight: "прямые", wavy: "волнистые", curly: "кудрявые", coiled: "мелко вьющиеся" },
  eyeColor: { brown: "карие", "dark-brown": "тёмно-карие", hazel: "ореховые", green: "зелёные", blue: "голубые", grey: "серые", amber: "янтарные" },
  facialFeatures: { soft: "мягкое", angular: "с резкими скулами", broad: "широкое", narrow: "вытянутое", mixed: "смешанное", "east-asian": "с восточными чертами" },
  nose: { small: "маленький", straight: "прямой", aquiline: "с горбинкой", snub: "курносый" },
  lips: { thin: "тонкие", medium: "обычные", full: "пухлые" },
  brows: { light: "светлые", thick: "густые", thin: "тонкие", joined: "сросшиеся" },
  heightTendency: { short: "невысокий", average: "средний", tall: "высокий" },
  bodyBuild: { slender: "хрупкое", average: "обычное", sturdy: "крепкое" }
};
const MARK: Record<KinMark, string> = { freckles: "веснушки", mole: "родинка", dimples: "ямочки", "left-handed": "левша" };
const word = (k: LookKey, v: unknown) => W[k][String(v)] ?? String(v);
const kinName = (k: KinMember) => k.relation === "мама" || k.relation === "папа" ? k.relation : `${k.relation} ${k.given}`;
function lookState() {
  const kin = family().kin ?? [];
  const opts = kin.length ? kinOptions(kin) : null, region = regionOptions(origin().stateId);
  const base = kin.length ? lookFromLine(kin, line, draft.familySeed ?? "") : null;
  const list = (k: LookKey): Array<{ value: unknown; from: KinMember[] }> => opts ? opts[k] as Array<{ value: unknown; from: KinMember[] }> : (region[k] as unknown[]).map(value => ({ value, from: [] }));
  const cur = (k: LookKey): unknown => (draft as unknown as Record<string, unknown>)[k] ?? base?.[k] ?? list(k)[0]?.value;
  const marks: KinMark[] = draft.marks ?? base?.marks ?? [];
  const markList: Array<{ value: KinMark; from: KinMember[] }> = opts ? opts.marks : region.marks.map(value => ({ value, from: [] }));
  return { kin, list, cur, marks, markList };
}
function lookText(): string {
  if (origin().fixed) return "Кожа светлая. Волосы светло-русые, прямые. Глаза тёмно-карие. Лицо с восточными чертами.";
  const { cur, marks } = lookState(), f = draft.sex === "female", h = cur("heightTendency");
  return `Кожа ${word("skinTone", cur("skinTone"))}. Волосы ${word("hairColor", cur("hairColor"))}, ${word("hairTexture", cur("hairTexture"))}. Глаза ${word("eyeColor", cur("eyeColor"))}. Лицо ${word("facialFeatures", cur("facialFeatures"))}, нос ${word("nose", cur("nose"))}, губы ${word("lips", cur("lips"))}, брови ${word("brows", cur("brows"))}. Вырастешь ${h === "short" ? (f ? "невысокой" : "невысоким") : h === "tall" ? (f ? "высокой" : "высоким") : "среднего роста"}, сложение ${word("bodyBuild", cur("bodyBuild"))}.${marks.length ? ` Приметы: ${marks.map(m => MARK[m]).join(", ")}.` : ""}`;
}
function renderLook() {
  const prince = !!origin().fixed, s = lookState();
  $("desc").innerHTML = `<span class="lbl">Каким ты будешь</span><p>${esc(lookText())}</p>`;
  ($("w4").querySelector(".like") as HTMLElement).hidden = prince || !s.kin.length;
  ($("likeR") as HTMLInputElement).value = String(line);
  const par = $("w4").querySelector(".parents") as HTMLElement;
  par.hidden = prince;
  if (s.kin.length) {
    const named = (k: KinMember) => k.relation === "мама" || k.relation === "папа" ? `<b>${k.relation} ${esc(k.given)}</b>` : `${!k.alive ? (k.relation === "дед" ? "покойный дед" : "покойная бабушка") : k.relation} <b>${esc(k.given)}</b>`;
    par.innerHTML = `Родные: ${s.kin.map(named).join(", ")}.`;
  } else par.textContent = "Родные неизвестны, поэтому черты берутся из обычных для твоего края.";
  const chips = (k: LookKey) => `<div class="chips">${s.list(k).map(o => `<button type="button" class="chip two" data-k="${k}" data-v="${esc(String(o.value))}" aria-pressed="${s.cur(k) === o.value}"><span>${esc(word(k, o.value))}</span>${o.from.length ? `<small>как у: ${esc(o.from.map(kinName).join(", "))}</small>` : ""}</button>`).join("")}</div>`;
  const marks = `<div class="chips">${s.markList.map(o => `<button type="button" class="chip two" data-m="${o.value}" aria-pressed="${s.marks.includes(o.value)}"><span>${MARK[o.value]}</span>${o.from.length ? `<small>как у: ${esc(o.from.map(kinName).join(", "))}</small>` : ""}</button>`).join("")}</div>`;
  const secs: Array<[string, string, string]> = [
    ["Кожа", word("skinTone", s.cur("skinTone")), chips("skinTone")],
    ["Волосы", `${word("hairColor", s.cur("hairColor"))}, ${word("hairTexture", s.cur("hairTexture"))}`, `<span class="sub">Цвет</span>${chips("hairColor")}<span class="sub">Какие</span>${chips("hairTexture")}`],
    ["Глаза", word("eyeColor", s.cur("eyeColor")), chips("eyeColor")],
    ["Лицо", word("facialFeatures", s.cur("facialFeatures")), `<span class="sub">Форма</span>${chips("facialFeatures")}<span class="sub">Нос</span>${chips("nose")}<span class="sub">Губы</span>${chips("lips")}<span class="sub">Брови</span>${chips("brows")}`],
    ["Рост и сложение", `${word("heightTendency", s.cur("heightTendency"))}, ${word("bodyBuild", s.cur("bodyBuild"))}`, `<span class="sub">Вырастет</span>${chips("heightTendency")}<span class="sub">Сложение</span>${chips("bodyBuild")}`],
    ["Приметы", s.marks.length ? s.marks.map(m => MARK[m]).join(", ") : "нет", marks]
  ];
  const box = $("sections"), open = qa(box, "details").map(d => (d as HTMLDetailsElement).open);
  box.innerHTML = prince ? "" : secs.map((x, i) => `<details class="ap"${open[i] || (!open.length && i === 0) ? " open" : ""}><summary>${x[0]}<em>${esc(x[1])}</em></summary><div class="in">${x[2]}</div></details>`).join("");
}
function fixLook() {
  if (origin().fixed) return;
  const s = lookState(), keysL: LookKey[] = ["skinTone", "hairColor", "hairTexture", "eyeColor", "facialFeatures", "nose", "lips", "brows", "heightTendency", "bodyBuild"];
  draft = { ...draft, ...Object.fromEntries(keysL.map(k => [k, s.cur(k)])), marks: s.marks } as Draft;
}
function statLevels(): number[] { return qa($("stats"), ".pst").map(p => p.querySelectorAll(".pip.on").length); }
function statWords(): string {
  const v = statLevels(), w = draft.sex === "female" ? ["сильная", "выносливая", "ловкая", "смышлёная", "обаятельная"] : ["сильный", "выносливый", "ловкий", "смышлёный", "обаятельный"];
  const idx = [0, 1, 2, 3, 4].sort((a, b) => v[b]! - v[a]!).filter(i => v[i]! >= 4).slice(0, 2);
  return idx.length ? idx.map(i => w[i]).join(" и ") : "ровные задатки";
}
function renderSummary() {
  const nm = $("nm") as HTMLInputElement, o = origin(), f = family();
  if (!nm.dataset.touched) nm.value = o.fixed ? draft.name : f.preview?.suggestedName ?? draft.name;
  nm.disabled = !!o.fixed;
  const town = MAP_NODES.find(n => n.id === o.settlementId)?.name ?? "";
  const year = (o.fixed ? SECOND_PRINCE_START_YEAR : 742) - draft.age;
  const parents = (f.preview?.members ?? []).filter(m => m.role === "мать" || m.role === "отец").map(m => m.name.split(" ")[0]).join(" и ");
  const s = lookState();
  const row = (a: string, b: string) => `<div><span>${a}</span><b>${esc(b)}</b></div>`;
  $("sumCard").innerHTML = row("Родится", `${town}, ${year} КЛ`) + row("Кто", o.label) + (parents ? row("Семья", parents) : "") + row("Начнёт", draft.age === 0 ? "с рождения" : `с ${yrs(draft.age)}`)
    + (o.fixed ? "" : row("Внешность", `${word("hairColor", s.cur("hairColor"))} ${word("hairTexture", s.cur("hairTexture"))} волосы, глаза ${word("eyeColor", s.cur("eyeColor"))}`)) + row("Задатки", statWords());
}
function wizardNext() {
  const id = stack[stack.length - 1]!;
  if (id === "w1") {
    const age = +($("age") as HTMLInputElement).value;
    const diff = qa($("diff"), "button").findIndex(b => b.getAttribute("aria-pressed") === "true");
    draft = { ...draft, age: origin().fixed ? 0 : age };
    difficulty = (["peaceful", "balanced", "harsh"] as WorldDifficultyId[])[diff] ?? "balanced";
  }
  if (id === "w2") draft = { ...draft, sex: origin().fixed ? "male" : qa($("sex"), "button").find(b => b.getAttribute("aria-pressed") === "true")?.textContent!.trim() === "Девочка" ? "female" : "male" };
  if (id === "w4") fixLook();
  if (id === "w5") { const v = statLevels(); draft = { ...draft, attributes: newLifeAttributes(Object.fromEntries(NEW_LIFE_ATTRIBUTES.map((a, i) => [a, v[i] ?? 3]))) }; }
  const order = ["w1", "w2", "w3", "w4", "w5", "w6"], i = order.indexOf(id);
  if (i >= 0 && i < 5) go(order[i + 1]!);
}
let difficulty: WorldDifficultyId = "balanced";
function born() {
  const nm = ($("nm") as HTMLInputElement).value.trim();
  if (!origin().fixed) draft = { ...draft, name: nm || family().preview?.suggestedName || draft.name };
  const prev = game?.lifeStatus === "dead" ? game : undefined;
  const result = startVeloriaCampaign({ kind: "veloria-character", draft, difficultyId: difficulty }, prev);
  if (!result.ok) { $("sumCard").insertAdjacentHTML("afterend", `<p class="err">${esc(result.errors.join(" "))}</p>`); return; }
  game = { ...result.state, lifeId: newLifeId() };
  log = [openingScene(game)];
  const m0 = game.playerMemory[0];
  if (m0) game = { ...game, playerMemory: [{ ...m0, text: `${diaryLine(game)}\n${clean(m0.text)}` }, ...game.playerMemory.slice(1)] };
  first = false; ($("nm") as HTMLInputElement).dataset.touched = "";
  saved();
  reset("gamePhone");
}

/** Как ребёнок зовёт родных в повествовании: «Мама», «Папа», «Бабушка»; имя остаётся в «Людях». */
function kinWord(id: string): string | undefined {
  const role = /^([^:;]{1,40}):/.exec(world().npcs[id]?.personality?.temperament ?? "")?.[1]?.trim() ?? "";
  return role === "мать" ? "Мама" : role === "отец" ? "Папа" : role === "бабушка" ? "Бабушка" : role === "дедушка" ? "Дедушка" : undefined;
}
/** Порядок близких: родители и опекуны, бабушки и деды, братья и сёстры, дяди и тёти, прислуга, потом друзья и соседи. */
function kinRank(p: { id: string; role?: string; family: boolean }): number {
  const r = p.role ?? "", fr = world().npcs[p.id]?.familyRole;
  if (!p.family) return 9;
  if (fr === "biological-parent" || fr === "guardian") return 0;
  if (/^(бабушка|дедушка)/.test(r)) return 1;
  if (/(брат|сестра)$/.test(r) && !/приют/.test(r)) return 2;
  if (/^(дядя|тётя)/.test(r)) return 3;
  if (/^(кормилица|няня|управляющий)/.test(r)) return 4;
  return 5;
}
const byKin = <T extends { id: string; role?: string; family: boolean }>(list: T[]) => list.map((p, i) => ({ p, i })).sort((a, b) => kinRank(a.p) - kinRank(b.p) || a.i - b.i).map(x => x.p);

/** Первая сцена прозой: время суток, дом, кто рядом. Без выходов и расстояний, они во вкладке «Мир». */
function openingScene(g: GameState): string {
  const w = world(), loc = w.locations[g.playerLocation];
  const known = new Set(knownPeople(w, g).map(p => p.id));
  const all = npcsAt(w, g.minute, g.playerLocation, g.npcDeaths).map(id => ({ npc: w.npcs[id]!, act: npcActivity(w, id, g.minute, g.npcDeaths) }));
  const near = all.filter(x => known.has(x.npc.id)).slice(0, 3);
  const who = near.map(x => `${kinWord(x.npc.id) ?? (x.npc.familyRole === "guardian" ? x.npc.name : x.npc.name.split(" ")[0])} ${x.act}.`);
  const strangers = all.length - all.filter(x => known.has(x.npc.id)).length;
  return [cap(partOfDay(g.minute)) + ".", loc?.description ?? "", ...who, strangers ? (strangers === 1 ? "Рядом незнакомый человек." : "Вокруг незнакомые люди.") : ""].filter(Boolean).join(" ");
}

/** Первая запись дневника: одна живая строка, подробности ниже. */
function diaryLine(g: GameState): string {
  const loc = world().locations[g.playerLocation];
  const p = openingScene(g).split(". ").slice(-1)[0] ?? "";
  return `${cap(partOfDay(g.minute))}, ${(loc?.name ?? "").toLocaleLowerCase("ru")}.${p && !p.startsWith(cap(partOfDay(g.minute))) ? ` ${p.replace(/\.?$/, ".")}` : ""}`;
}

/** «Осмотреться» без ИИ: не повтор первой сцены, а кто чем занят рядом и куда отсюда можно пойти. */
function lookScene(g: GameState): string {
  const w = world(), loc = w.locations[g.playerLocation];
  const known = new Set(knownPeople(w, g).map(p => p.id));
  const all = npcsAt(w, g.minute, g.playerLocation, g.npcDeaths);
  const who = all.filter(id => known.has(id)).slice(0, 4).map(id => `${kinWord(id) ?? (w.npcs[id]!.familyRole === "guardian" ? w.npcs[id]!.name : w.npcs[id]!.name.split(" ")[0])} ${npcActivity(w, id, g.minute, g.npcDeaths)}.`);
  const strangers = all.length - all.filter(id => known.has(id)).length;
  const exits = (loc?.exits ?? []).map(e => w.locations[e.to]?.name).filter(Boolean).map(n => n!.replace(/^[^:]+:\s*/, "").toLocaleLowerCase("ru"));
  return [
    who.length ? `Ты оглядываешься. ${who.join(" ")}` : "Ты оглядываешься. Рядом никого из знакомых.",
    strangers ? (strangers === 1 ? "Поодаль незнакомый человек." : "Поодаль незнакомые люди.") : "",
    exits.length ? `Отсюда можно пойти: ${exits.join(", ")}.` : ""
  ].filter(Boolean).join(" ");
}

// ===================== игра =====================
function statusWord(): string {
  const dev = game?.development;
  if (game?.lifeStatus === "dead") return draft.sex === "female" ? "умерла" : "умер";
  if (!dev) return "";
  const f = dev.sex === "female", n = dev.needs;
  if (dev.physical.health < 40) return f ? "больна" : "болен";
  if (n.hunger >= 50) return f ? "голодна" : "голоден";
  if (n.tiredness >= 60) return f ? "устала" : "устал";
  if (n.distress >= 60) return f ? "расстроена" : "расстроен";
  return "";
}
const ageWord = () => game?.development ? formatAge(game.development, game.minute) : yrs(game?.playerProfile?.age ?? 0);
const whenText = () => game ? `${season(game.minute)} ${yearKLOf(game.minute, game.worldStartYearKL ?? 742)} КЛ, ${partOfDay(game.minute)}` : "";
const here = () => { const w = world(), g = game!; const town = MAP_NODES.find(n => n.id === (g.settlementId ?? "roven")); return { town, loc: w.locations[g.playerLocation] ?? w.locations[w.startLocationId]! }; };
const heroOrigin = () => birthOrigin((game?.campaign?.recipe as { draft?: { birthOriginId?: string } } | undefined)?.draft?.birthOriginId);
function header() {
  qa(app, ".hName").forEach(b => { b.textContent = game?.playerName ?? ""; });
  qa(app, ".hAge").forEach(b => { b.textContent = ageWord(); });
  const st = statusWord(), hs = $("hState");
  hs.textContent = st; (hs.previousSibling as Text | null)?.replaceWith?.(document.createTextNode(st ? " · " : ""));
}
function storyHtml(): string {
  return log.map(l => l.startsWith("> ") ? `<p class="you">${esc(l.slice(2))}</p>` : `<p>${esc(clean(l))}</p>`).join("") + (busy ? '<p class="wait"><i></i><i></i><i></i></p>' : "");
}
function renderGame() {
  if (!game) return;
  header();
  $("aiLine").hidden = aiOn();
  const { town, loc } = here();
  const page = $("page");
  qa(page, ":scope > .wait,#storyBaby,#storyKid").forEach(e => e.remove());
  const story = $("storyAlt"); story.hidden = false;
  $("chapPlace").textContent = town && town.id !== loc.id ? `${town.name} · ${loc.name}` : loc.name;
  (page.querySelector(".chapter em") as HTMLElement).textContent = whenText();
  $("lockBtn").hidden = !locked();
  story.innerHTML = storyHtml();
  page.scrollTop = page.scrollHeight;
  $("hints").innerHTML = hints().map(h => `<button type="button">${esc(h)}</button>`).join("");
}
function hints(): string[] {
  if (!game) return [];
  const caps = capabilities(game.development, game.minute), w = world(), loc = w.locations[game.playerLocation];
  if (caps.stage.id === "infancy") return caps.infantActions.map(a => INFANT_ACT_LABELS[a]);
  const go = caps.canWalk ? (loc?.exits ?? []).map(e => `идти ${w.locations[e.to]?.name ?? e.to}`) : [];
  return ["осмотреться", ...go.slice(0, 3)];
}
function push(lines: string[]) { log = [...log, ...lines]; }
function setGame(next: GameState) { game = next; saved(); }
const SOCIAL: InfantActId[] = ["cry", "smile", "babble", "reach", "cling", "play"];
function sceneFor(next: ActionResult, performed: Action, text: string) {
  if (!next.ok || next.state.lifeStatus === "dead") return;
  const ev: SceneEvent | null = performed.type === "say" ? "speech" : performed.type === "gesture" ? "gesture" : performed.type === "look" ? "look" : performed.type === "move" ? "arrival" : performed.type === "infant" && SOCIAL.includes(performed.act) ? "infant" : null;
  if (ev) liveScene(next.state, text, ev);
}
function makeAi() {
  return keys.withKey((key, provider) => new DirectAi(provider as AiProviderId, key, aiModel || DEFAULT_MODEL[provider as AiProviderId] || "", u => recordUsage({ requests: 1, inputTokens: u.input, outputTokens: u.output })));
}
function liveScene(after: GameState, playerText: string, event: SceneEvent) {
  const w = world(), descriptive = event === "look" || event === "arrival";
  if (!descriptive && !hasListeners(w, after)) return;
  const ai = makeAi(); if (!ai) return;
  const context = buildSceneContext(w, after, playerText, { lang, event, person, adult: adultAllowed() && adult });
  const envelope = buildSceneEnvelope(context, playerText);
  busy = true; renderGame();
  ai.writeScene(envelope).then(raw => {
    const scene = coerceScene(raw, envelope.outputContract.speakers, after.playerName, context.adult);
    if (!scene || game !== after) return;
    const applied = applyScene(w, after, scene);
    setGame(applied.state); push(applied.lines);
  }).catch(() => push(["Рассказчик сейчас не ответил. Мир не изменился."])).finally(() => { busy = false; renderGame(); });
}
function run(textRaw: string) {
  const text = textRaw.trim();
  if (!text || !game || busy) return;
  if (game.lifeStatus === "dead") return;
  const w = world();
  if (safety.banned) { push(["Доступ к игре закрыт."]); renderGame(); return; }
  if (isChildSafetyViolation(w, game, text)) {
    const { record, message } = registerViolation({ load: () => localSafety.load(), save: r => localSafety.save(r), report: (_r, reason) => { if (cloud && session) void reportChildSafetyStrike(cloud, reason).catch(() => undefined); } });
    safety = record; push([message]); renderGame(); return;
  }
  const infant = (Object.entries(INFANT_ACT_LABELS) as Array<[InfantActId, string]>).find(([, l]) => l.toLocaleLowerCase("ru") === text.toLocaleLowerCase("ru"));
  const apply = (action: Action, label: string) => { const r = applyAction(w, game!, action); setGame(r.state); push([`> ${label}`, ...(action.type === "look" && r.ok ? [lookScene(r.state)] : r.message.split("\n"))]); sceneFor(r, action, label); renderGame(); };
  if (infant) return apply({ type: "infant", act: infant[0] }, text);
  const parsed = parseAction(w, text);
  if (parsed.ok) return apply(parsed.action, text);
  const local = understandFreeText(w, game, text);
  if (local?.ok) return apply(local.action, text);
  const ai = makeAi();
  if (!ai) { push([`> ${text}`, parsed.reason]); renderGame(); return; }
  busy = true; push([`> ${text}`]); renderGame();
  const snapshot = game;
  void resolveWithAi(w, snapshot, text, new CachingProposer(ai, () => recordUsage({ cacheHits: 1 }))).then(r => {
    if (game === snapshot) { setGame(r.state); push(r.message.split("\n")); if (r.action && r.ok) sceneFor(r, r.action, text); }
  }, () => push(["Рассказчик сейчас не ответил. Мир не изменился."])).finally(() => { busy = false; renderGame(); });
}
function live(kind: string) {
  if (!game || busy || game.lifeStatus === "dead") return;
  const action: Action = kind === "Час" ? { type: "wait", minutes: 60 } : { type: "live", days: kind === "День" ? 1 : 7 };
  const r = applyAction(world(), game, action);
  setGame(r.state); push(r.message.split("\n")); renderGame();
}

// ===================== персонаж, мир, карта, память =====================
function renderChar() {
  if (!game) return;
  header();
  const o = heroOrigin(), { town } = here();
  $("hRole").textContent = [o?.label, town?.name].filter(Boolean).join(" · ");
  const caps = capabilities(game.development, game.minute), idx = LIFE_STAGES.findIndex(s => s.id === caps.stage.id);
  $("stageT").textContent = `${caps.stage.label} · ${ageWord()}`;
  qa($("stageTrack"), "i").forEach((t, i) => { t.className = i <= idx ? "done" : ""; });
  $("charLook").textContent = heroLook();
  const people = byKin(knownPeople(world(), game).filter(p => p.alive)).slice(0, 8);
  const ppl = $("charS").querySelector(".ppl") as HTMLElement;
  ppl.innerHTML = people.map(p => `<div class="person"><span class="a" style="background:var(--surface2);color:var(--muted)">${esc(p.name.charAt(0))}</span><div><b>${esc(p.name)}</b><span>${esc([p.role, p.age !== undefined ? ageText(p.age) : ""].filter(Boolean).join(", "))}</span>${p.about ? `<p class="pd">${esc(p.about)}</p>` : ""}</div>${p.role ? `<span class="heart ${p.family ? "h-good" : "h-mid"}">${esc(p.role.split(/[,:]/)[0]!)}</span>` : ""}</div>`).join("");
  (ppl.closest(".card") as HTMLElement).hidden = !people.length;
  const skills = [caps.maxWordsPerUtterance >= 20 ? "говорит свободно" : caps.maxWordsPerUtterance > 0 ? "говорит словами" : "", caps.canWalk ? "ходит" : caps.canCrawl ? "ползает" : "", caps.canTrade ? "умеет считать монеты" : ""].filter(Boolean);
  const sk = qa($("charS"), ".card").find(c => c.querySelector("h3")?.textContent === "Умеет")!;
  sk.hidden = !skills.length;
  sk.querySelector(".chips")!.innerHTML = skills.map(s => `<span class="chip">${esc(s)}</span>`).join("");
}
/** Внешность героя словами, как на шаге «Внешность»: без цифр и служебных полей. */
function heroLook(): string {
  const id = game?.playerAppearance?.identity, d = (game?.campaign?.recipe as { draft?: Draft } | undefined)?.draft;
  if (!id) return "";
  const parts = [
    id.skinTone !== undefined ? `Кожа ${word("skinTone", id.skinTone)}.` : "",
    id.naturalHairColor ? `Волосы ${word("hairColor", id.naturalHairColor)}${id.hairTexture ? `, ${word("hairTexture", id.hairTexture)}` : ""}.` : "",
    id.eyeColor ? `Глаза ${word("eyeColor", id.eyeColor)}.` : "",
    id.facialFeatures ? `Лицо ${word("facialFeatures", id.facialFeatures)}${d?.nose ? `, нос ${word("nose", d.nose)}` : ""}${d?.lips ? `, губы ${word("lips", d.lips)}` : ""}${d?.brows ? `, брови ${word("brows", d.brows)}` : ""}.` : "",
    d?.marks?.length ? `Приметы: ${d.marks.map(m => MARK[m]).join(", ")}.` : ""
  ];
  return parts.filter(Boolean).join(" ");
}
const clean = (t: string) => t.replace(/^\[[^\]]+\]\s*/, "").replace(/\s*Выходы:[^]*$/, "");
/** Первая фраза записи и остальное: в дневнике видна одна строка, подробности по нажатию. */
const splitFirst = (t: string): [string, string] => { const nl = t.indexOf("\n"); if (nl > 0) return [t.slice(0, nl), t.slice(nl + 1)]; const m = /^(.+?[.!?…])\s+(.+)$/s.exec(t); return m ? [m[1]!, m[2]!] : [t, ""]; };
function known(): Set<string> { return knownSettlementIds(game?.settlementId ?? "roven", heroOrigin()?.stateId, game?.visitedSettlements); }
function markers(mini: boolean, me: { x: number; y: number }, vb?: [number, number, number, number]): string {
  const pos = (x: number, y: number) => vb ? [((x * 6 - vb[0]) / vb[2]) * 100, ((y * 7.6 - vb[1]) / vb[3]) * 100] : [x, y];
  const k = known();
  return MAP_NODES.filter(n => k.has(n.id)).map(n => {
    const [l, t] = pos(n.x, n.y);
    if (mini && (l! < 2 || l! > 98 || t! < 2 || t! > 98)) return "";
    const isMe = n.x === me.x && n.y === me.y;
    return `<button type="button" class="mp${isMe ? " me" : ""}" style="left:${l!.toFixed(1)}%;top:${t!.toFixed(1)}%"${mini ? ' tabindex="-1"' : ` data-p="${n.id}"`} aria-pressed="false"><i></i><span>${esc(n.name)}</span></button>`;
  }).join("") + (() => { const [l, t] = pos(me.x, me.y); return `<div class="mehere" style="left:${l!.toFixed(1)}%;top:${t!.toFixed(1)}%"><b>Ты здесь</b><div class="dot"></div></div>`; })();
}
function renderWorld() {
  if (!game) return;
  const { town, loc } = here(), w = world();
  const country = COUNTRIES.find(c => c.id === town?.countryId);
  $("herePlace").textContent = town && town.id !== loc.id ? `${town.name}, ${loc.name.toLocaleLowerCase("ru")}` : loc.name;
  $("hereSub").textContent = [country?.name, whenText()].filter(Boolean).join(" · ");
  const me = { x: town?.x ?? 38, y: town?.y ?? 47 };
  const vb: [number, number, number, number] = [me.x * 6 - 130, me.y * 7.6 - 115, 260, 230];
  const mini = $("worldS").querySelector(".mapmini") as HTMLElement;
  mini.innerHTML = landSvg.replace('viewBox="0 0 600 760"', `viewBox="${vb.join(" ")}"`) + markers(true, me, vb) + '<span class="open">Открыть карту</span>';
  const rows = (loc.exits ?? []).map(e => w.locations[e.to]).filter(Boolean);
  const goCard = $("worldS").querySelector(".body > .card") as HTMLElement;
  const chev = '<svg class="i" viewBox="0 0 24 24" style="width:16px;height:16px;color:var(--muted)"><path d="M9 6l6 6-6 6"/></svg>';
  goCard.innerHTML = rows.map(l => `<div class="row"><div><b>${esc(l!.name)}</b><span>${esc(l!.description.split(".")[0]!.toLocaleLowerCase("ru"))}</span></div>${chev}</div>`).join("");
  const rumors = game.playerMemory.filter(m => m.kind === "heard").slice(-3).reverse();
  const cards = qa($("worldS"), ".body > .card"), lbls = qa($("worldS"), ".body > .lbl");
  const rumorCard = cards[cards.length - 1]!, rumorLbl = lbls[lbls.length - 1]!;
  rumorCard.innerHTML = rumors.map(r => `<p class="rumor"><em>слух</em>${esc(r.text)}</p>`).join("");
  rumorCard.hidden = rumorLbl.hidden = !rumors.length;
  const goLbl = lbls.find(l => l.textContent === "Куда можно пойти");
  if (goLbl) goLbl.hidden = goCard.hidden = !rows.length;
}
function renderMap() {
  if (!game) return;
  const { town } = here(), me = { x: town?.x ?? 38, y: town?.y ?? 47 };
  Object.assign(window, { __meX: me.x / 100, __meY: me.y / 100 });
  const inner = $("mapInner");
  qa(inner, ".mp:not(.area),.mehere").forEach(e => e.remove());
  inner.insertAdjacentHTML("beforeend", markers(false, me));
  $("placeCard").hidden = true;
  setTimeout(() => (window as unknown as { __mapFix?: () => void }).__mapFix?.(), 30);
}
function placeCard(id: string) {
  const n = MAP_NODES.find(x => x.id === id); if (!game) return;
  if (!n) {
    const a = AREA_LORE[id]; if (!a) return;
    $("pcN").textContent = cap(id); $("pcK").textContent = a.kind; $("pcW").hidden = true; $("pcC").hidden = true; $("pcD").textContent = a.text;
    qa($("mapInner"), "[data-p]").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.p === id)));
    $("placeCard").hidden = false; return;
  }
  const country = COUNTRIES.find(c => c.id === n.countryId)?.name, region = REGIONS.find(r => r.id === n.regionId)?.name;
  $("pcN").textContent = n.name; $("pcK").textContent = [country, region].filter(Boolean).join(" · ");
  const cur = game.settlementId ?? "roven";
  const days = (d: number) => `${d} ${d % 10 === 1 && d % 100 !== 11 ? "день" : [2, 3, 4].includes(d % 10) && ![12, 13, 14].includes(d % 100) ? "дня" : "дней"}`;
  const opts = id === cur ? [] : travelOptions(cur, id, game.minute);
  const wtxt = id === cur ? "Ты здесь" : opts.map(o => `${o.overland ? "По суше" : "Морем"}: ${days(o.plan.totalDays)}`).join(" · ");
  const pw = $("pcW"); pw.textContent = wtxt; pw.hidden = !wtxt;
  $("pcC").hidden = true;
  // Канонические подсказки, которых герой знать не может, в карточку не попадают.
  $("pcD").textContent = (placeStory(id)?.text ?? "").split(/(?<=[.!?])\s+/).filter(t => !/второй принц/i.test(t)).join(" ");
  qa($("mapInner"), "[data-p]").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.p === id)));
  $("placeCard").hidden = false;
}
let memQuery = "";
function renderMemory() {
  if (!game) return;
  const q = memQuery.toLocaleLowerCase("ru");
  const entries = game.playerMemory.filter(m => !q || m.text.toLocaleLowerCase("ru").includes(q)).slice().reverse();
  let h = "", last = "";
  for (const m of entries) {
    const t = cap(`${season(m.minute)} ${yearKLOf(m.minute, game.worldStartYearKL ?? 742)} КЛ`);
    if (t !== last) { h += `<span class="lbl">${esc(t)}</span>`; last = t; }
    const [head, more] = splitFirst(clean(m.text));
    h += more ? `<details class="mi"><summary>${esc(head)}</summary><p class="more">${esc(more)}</p></details>` : `<details class="mi"><summary>${esc(head)}</summary></details>`;
  }
  $("memD").innerHTML = h;
  const people = byKin(knownPeople(world(), game)).filter(p => !q || `${p.name} ${p.role ?? ""} ${p.nature ?? ""} ${p.looks ?? ""}`.toLocaleLowerCase("ru").includes(q));
  $("memP").innerHTML = people.map(p => `<div class="pm"><b>${esc(p.role ? `${p.name}, ${p.role.split(/[,:]/)[0]}` : p.name)}</b>${p.role ? `<span class="heart ${p.family ? "h-good" : "h-mid"}">${esc(p.role.split(/[,:]/)[0]!)}</span>` : ""}<p>${esc(p.alive ? [p.about, p.nature && !(p.about ?? "").toLocaleLowerCase("ru").includes(p.nature.split(/[,;]/)[0]!.toLocaleLowerCase("ru")) ? `${cap(p.nature)}.` : ""].filter(Boolean).join(" ") : "Его уже нет в живых.")}</p></div>`).join("");
}

// ===================== меню, жизни, настройки =====================
function renderMenu() {
  let h = "";
  if (alive() && game) {
    const { town, loc } = here();
    h += `<div class="cont"><span class="lbl" style="color:inherit;opacity:.8">Продолжить</span><b>${esc(game.playerName)}, ${esc(ageWord())}</b><span>${esc(`${town?.name ?? ""}${town && town.id !== loc.id ? `, ${loc.name.toLocaleLowerCase("ru")}` : ""} · ${season(game.minute)} ${yearKLOf(game.minute, game.worldStartYearKL ?? 742)} КЛ`)}</span><button class="btn primary" type="button" data-act="play" style="margin-top:6px">Продолжить жизнь</button></div>`;
  } else h += '<div class="menuHi"><b>С возвращением</b><span>Живого героя пока нет. Начни новую жизнь.</span></div>';
  h += `<button class="btn${alive() ? "" : " primary"}" type="button" data-act="newlife"><svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Новая жизнь</button>`;
  if (alive()) h += '<button class="btn ghost" type="button" data-go="livesS"><svg class="i" viewBox="0 0 24 24"><path d="M6 4h9l3 3v13H6z"/><path d="M9 4v5h6"/></svg>Мои жизни</button>';
  if (locked()) h += '<button class="aiNote lockNote" type="button" data-act="pinOpen"><svg class="i" viewBox="0 0 24 24" style="width:16px;height:16px"><rect x="5" y="10" width="14" height="10" rx="3"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/></svg><span>Ключ ИИ закрыт. <b>Открыть PIN-кодом</b></span></button>';
  else if (!aiOn()) h += '<div class="aiNote"><svg class="i" viewBox="0 0 24 24"><path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z"/></svg><span>ИИ не подключён, мир пока отвечает скупо. <a href="#" data-go="aiS">Подключить</a></span></div>';
  $("menuBody").innerHTML = h;
}
let savedAt = "";
function renderLives() {
  let h = '<span class="lbl">Велория</span>';
  if (alive() && game) h += `<div class="life"><div><b>${esc(game.playerName)}, ${esc(ageWord())}</b><span>${esc([heroOrigin()?.label, BIRTH_STATES.find(s => s.id === heroOrigin()?.stateId)?.name].filter(Boolean).join(" · "))}</span><span class="saved">Сохранено ${esc(savedAt || "только что")}</span></div><button class="btn primary sm2" type="button" data-act="play">Продолжить</button></div>`;
  h += '<button class="btn" type="button" data-act="newlife"><svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Новая жизнь в Велории</button><span class="lbl">Другие миры</span><div class="life soon"><div><b>Скоро</b><span>Здесь появятся жизни из новых миров</span></div></div><p class="qs">Игра сохраняется сама после каждого хода. Смерть окончательная: умершую жизнь нельзя загрузить, остаётся только её хроника.</p>';
  $("livesList").innerHTML = h;
}
function renderSettings() {
  $("aiRowTxt").innerHTML = aiOn() ? `<i class="dot"></i>${esc(`${providerLabel(keys.provider as AiProviderId)}, ${aiModel || DEFAULT_MODEL[keys.provider as AiProviderId] || ""}`)}` : "не подключён";
  const ad = $("adult") as HTMLButtonElement;
  if (!adultAllowed()) { ad.disabled = true; ad.setAttribute("aria-pressed", "false"); $("adultTxt").textContent = "доступно только с 18 лет"; }
  else { ad.disabled = false; ad.setAttribute("aria-pressed", String(adult)); $("adultTxt").textContent = adult ? "только 18+, включено" : "только 18+, выключено"; }
  qa($("person"), "button").forEach((b, i) => b.setAttribute("aria-pressed", String(String(i + 1) === person)));
  qa($("lang"), "button").forEach(b => b.setAttribute("aria-pressed", String(b.textContent!.trim().toLowerCase() === lang)));
  $("toMenuRow").hidden = stack[0] === "menuS" && stack.length === 2;
}

// ===================== ИИ: настоящая проверка ключа =====================
const PROV: Array<[string, AiProviderId]> = [["OpenRouter", "openrouter"], ["DeepSeek", "deepseek"], ["Claude", "anthropic"], ["OpenAI", "openai"]];
const providerLabel = (p: AiProviderId) => PROV.find(x => x[1] === p)?.[0] ?? p;
let aiDone = false;
let lastSecret: { provider: string; key: string; model: string } | null = null;
async function pinSave() {
  const v = ($("pinNew") as HTMLInputElement).value.trim();
  if (!isValidPin(v) || !lastSecret) { $("pinNewErr").hidden = false; return; }
  $("pinNewErr").hidden = true;
  try { await savePin(v, lastSecret); } catch { $("pinNewErr").textContent = "Браузер не дал запомнить устройство."; $("pinNewErr").hidden = false; return; }
  $("pinSet").innerHTML = '<div class="aistate ok"><span class="tick"><svg class="i" viewBox="0 0 24 24" style="width:14px;height:14px"><path d="M5 12l5 5 9-10"/></svg></span><div><b>Устройство запомнило ключ</b>В следующий раз хватит PIN-кода.</div></div>';
}
function pinSheet(open: boolean) { $("pinSheet").hidden = !open; $("pinShade").hidden = !open; if (open) { ($("pinIn") as HTMLInputElement).value = ""; $("pinErr").hidden = true; setTimeout(() => $("pinIn").focus(), 50); } }
async function pinOk() {
  const secret = await unlockWithPin(($("pinIn") as HTMLInputElement).value.trim());
  if (secret && isAiProviderId(secret.provider)) {
    keys.unlock(secret.provider, secret.key); aiModel = secret.model; setPref("openworld.ai.model", aiModel);
    pinSheet(false); const cur = stack[stack.length - 1]; if (cur) render[cur]?.(); return;
  }
  const left = pinTriesLeft();
  $("pinErr").hidden = false;
  $("pinErr").textContent = hasPin() && left > 0 ? `Неверный PIN, осталось попыток: ${left}` : "PIN введён неверно 5 раз. Устройство забыло ключ, введи пароль.";
  if (!hasPin()) { const cur = stack[stack.length - 1]; if (cur) render[cur]?.(); }
}
function renderAi() {
  aiDone = false;
  $("pinSet").hidden = true;
  const btn = $("aiGo"); btn.textContent = "Подтвердить"; $("aiState").hidden = true;
  const rec = loadVaultRecord(), prov = (rec?.provider ?? pref("openworld.ai.provider", "openrouter")) as AiProviderId;
  qa($("aiProv"), "button").forEach(b => b.setAttribute("aria-pressed", String(PROV.find(x => x[0] === b.textContent!.trim())?.[1] === prov)));
  ($("aiModel") as HTMLInputElement).value = aiModel;
}
async function connectAi() {
  const st = $("aiState"), btn = $("aiGo") as HTMLButtonElement;
  if (aiDone) { if (alive()) reset("gamePhone"); else back(); return; }
  const err = (t: string, h: string) => { st.className = "aistate err"; st.innerHTML = `<div><b>${esc(t)}</b>${esc(h)}</div>`; st.hidden = false; st.scrollIntoView({ block: "nearest" }); };
  const provName = qa($("aiProv"), "button").find(b => b.getAttribute("aria-pressed") === "true")?.textContent!.trim() ?? "OpenRouter";
  const provider = PROV.find(x => x[0] === provName)?.[1] ?? "openrouter";
  let key = ($("aiKey") as HTMLInputElement).value.trim();
  const model = ($("aiModel") as HTMLInputElement).value.trim() || DEFAULT_MODEL[provider] || "";
  const p1 = ($("aiPw") as HTMLInputElement).value, p2 = ($("aiPw2") as HTMLInputElement).value;
  const rec = loadVaultRecord();
  // Ключ уже сохранён раньше: пустое поле ключа и пароль открывают его.
  if (!key && rec) {
    if (!p1) return err("Нет пароля", "Введи пароль, которым ты зашифровал ключ.");
    try { key = await decryptApiKey(rec, p1); } catch { return err("Пароль не подошёл", "Это не тот пароль, которым зашифрован ключ."); }
  } else {
    if (!key) return err("Нет ключа", "Вставь ключ, который скопировал на сайте сервиса.");
    if (!model) return err("Не выбрана модель", "Впиши название модели. Бесплатные на OpenRouter заканчиваются на :free.");
    if (p1.length < 10) return err("Слишком короткий пароль", "Нужно хотя бы 10 символов.");
    if (p1 !== p2) return err("Пароли не совпадают", "Введи один и тот же пароль два раза.");
  }
  const prov = !($("aiKey") as HTMLInputElement).value.trim() && rec ? rec.provider as AiProviderId : provider;
  st.className = "aistate load"; st.innerHTML = '<span class="spin"></span><div><b>Проверяем подключение…</b>Отправляем ИИ пробное сообщение.</div>'; st.hidden = false; btn.disabled = true; btn.style.opacity = ".6";
  const t0 = performance.now();
  try {
    await callModel(prov, key, model, "Ответь одним словом.", "Привет", 16);
  } catch (e) {
    btn.disabled = false; btn.style.opacity = "1";
    const k = e instanceof AiError ? e.kind : "network";
    return k === "key" ? err("Ключ не подошёл", "Сервис его не принял. Проверь, что скопировал ключ целиком.")
      : k === "model" ? err("Модель не найдена", "Проверь название модели на странице сервиса.")
      : k === "limit" ? err("Лимит сервиса", "Сервис просит подождать или пополнить счёт.")
      : err("Сервис не ответил", "Проверь интернет и попробуй ещё раз.");
  }
  btn.disabled = false; btn.style.opacity = "1";
  if (($("aiKey") as HTMLInputElement).value.trim()) {
    const next = await encryptApiKey(key, p1, prov);
    saveVaultRecord(next);
    if (cloud && session) void putCloudKey(cloud, next).catch(() => undefined);
  }
  keys.unlock(prov, key); aiModel = model; setPref("openworld.ai.model", model); setPref("openworld.ai.provider", prov);
  ($("aiKey") as HTMLInputElement).value = ""; ($("aiPw") as HTMLInputElement).value = ""; ($("aiPw2") as HTMLInputElement).value = "";
  const secs = ((performance.now() - t0) / 1000).toFixed(1).replace(".", ",");
  st.className = "aistate ok"; st.innerHTML = `<span class="tick"><svg class="i" viewBox="0 0 24 24" style="width:14px;height:14px"><path d="M5 12l5 5 9-10"/></svg></span><div><b>Подключено</b>Модель ${esc(model)} ответила за ${secs} с. Можно играть.</div>`;
  btn.textContent = "Начать играть"; aiDone = true;
  lastSecret = { provider: prov, key, model }; $("pinSet").hidden = false;
}

// ===================== сохранения =====================
let cloudTimer: ReturnType<typeof setTimeout> | undefined, lastCloud = 0;
function saved() {
  if (!game) return;
  const g = game;
  const info = writeAutosave(WORLD_ID, g);
  if (info.ok && info.savedAt) { const d = new Date(info.savedAt); savedAt = `сегодня в ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }
  const next = buryIfDead(WORLD_ID, g, graveyard);
  if (next !== graveyard) { graveyard = next; saveGraveyard(next); if (cloud && session) void putCloudSave(cloud, GRAVEYARD_WORLD, GRAVEYARD_SLOT, JSON.stringify(next)).catch(() => undefined); }
  if (!cloud || !session || safety.banned) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => { lastCloud = Date.now(); void putCloudSave(cloud, WORLD_ID, AUTO_SLOT, JSON.stringify({ schemaVersion: 1, worldId: WORLD_ID, game, savedAt: new Date().toISOString() })).catch(() => undefined); }, Math.max(1500, 20_000 - (Date.now() - lastCloud)));
}
function loadSave(json: string | null): boolean {
  if (!json) return false;
  const imported = importGamePayload(json, WORLDS.map(w => w.id), WORLD_ID);
  if (!imported || imported.worldId !== WORLD_ID || !imported.game.playerProfile || loadBlockedByDeath(imported.game, graveyard)) return false;
  game = migrateStateForWorld(WORLD_ID, imported.game);
  log = game.playerMemory.slice(-30).map(m => m.text);
  return true;
}
async function afterSignIn() {
  if (!cloud || !session) return;
  profile = await fetchProfile(cloud, session.user.id).catch(() => null);
  if (profile?.banned) { safety = { ...localSafety.load(), banned: true }; localSafety.save(safety); }
  if (profile?.birthDate) { birthDate = profile.birthDate; setPref("openworld.birthdate", birthDate); }
  else if (profile && birthDate) void saveBirthDate(cloud, profile.id, birthDate).catch(() => undefined);
  if (profile) { adult = profile.adultMode; setPref("openworld.adult-content", String(adult)); }
  const remote = await getCloudSave(cloud, GRAVEYARD_WORLD, GRAVEYARD_SLOT).catch(() => null);
  try { const list = remote ? JSON.parse(remote) : []; graveyard = mergeGraveyards(graveyard, Array.isArray(list) ? list : []); saveGraveyard(graveyard); } catch { /* битая запись */ }
  if (!game) loadSave(await getCloudSave(cloud, WORLD_ID, AUTO_SLOT).catch(() => null));
  if (!loadVaultRecord()) { const k = await getCloudKey(cloud).catch(() => null); if (k) saveVaultRecord(k); }
}

// ===================== что показываем на каждом экране =====================
const render: Record<string, () => void> = {
  ageS: () => { ageCalc(); },
  menuS: renderMenu,
  w1: () => {
    qa(app, ".wTitle").forEach(b => { b.textContent = first ? "Твоя первая жизнь" : "Новая жизнь в Велории"; });
    $("welcome").hidden = !first;
    qa(app, "[data-wback]").forEach(b => { b.style.visibility = ""; });
    ($("w1").querySelector("[data-wback]") as HTMLElement).style.visibility = first ? "hidden" : "";
    const a = $("age") as HTMLInputElement; a.value = String(draft.age); a.disabled = !!origin().fixed; a.dispatchEvent(new Event("input"));
  },
  w2: renderStates, w3: renderFamily, w4: renderLook, w6: renderSummary,
  gamePhone: renderGame, charS: renderChar, worldS: renderWorld, mapPhone: renderMap, memS: renderMemory,
  setS: renderSettings, livesS: renderLives, aiS: renderAi
};

function act(a: string, el: HTMLElement) {
  if (a === "ageOk") confirmAge();
  else if (a === "next") wizardNext();
  else if (a === "born") born();
  else if (a === "play") reset("gamePhone");
  else if (a === "newlife") { first = false; startWizard(); }
  else if (a === "menu") reset("menuS");
  else if (a === "logout") { if (cloud && session) void signOut(cloud); session = null; logout(); }
  else if (a === "pinSave") void pinSave();
  else if (a === "pinOpen") pinSheet(true);
  else if (a === "pinClose") { pinSheet(false); if (el.dataset.go) go(el.dataset.go); }
  else if (a === "pinOk") void pinOk();
  else if (a === "otherfam") { draft = { ...draft, familySeed: seed(), skinTone: undefined, hairColor: undefined, hairTexture: undefined, eyeColor: undefined, facialFeatures: undefined, nose: undefined, lips: undefined, brows: undefined, heightTendency: undefined, bodyBuild: undefined, marks: undefined }; ($("nm") as HTMLInputElement).dataset.touched = ""; line = 50; renderFamily(); }
}

function init() {
  app = $("app"); site = $("site");
  if (loadSave(readAutosave(undefined, WORLD_ID) ?? readAutosave())) { /* продолжим с места */ }
  $("bm").addEventListener("change", ageCalc); $("by").addEventListener("change", ageCalc);
  $("pinIn").addEventListener("keydown", e => { if ((e as KeyboardEvent).key === "Enter") void pinOk(); });
  $("nm").addEventListener("input", function (this: HTMLInputElement) { this.dataset.touched = "1"; });
  $("states").addEventListener("click", e => { const b = (e.target as HTMLElement).closest<HTMLElement>("[data-st]"); if (!b) return; const o = BIRTH_ORIGINS.find(x => x.stateId === b.dataset.st); if (o && origin().stateId !== o.stateId) chooseOrigin(o); renderStates(); });
  $("origins").addEventListener("click", e => { const b = (e.target as HTMLElement).closest<HTMLElement>("[data-o]"); if (!b) return; const o = birthOrigin(b.dataset.o); if (o) chooseOrigin(o); renderStates(); });
  ($("w2").querySelector(".body > .btn") as HTMLElement).addEventListener("click", () => { const pool = BIRTH_ORIGINS.filter(o => o.stateId === origin().stateId); chooseOrigin(pool[Math.floor(Math.random() * pool.length)]!); draft = { ...draft, familySeed: seed() }; renderStates(); });
  $("sections").addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("button"); if (!b) return;
    const s = lookState();
    if (b.dataset.m) { const m = b.dataset.m as KinMark; draft = { ...draft, marks: s.marks.includes(m) ? s.marks.filter(x => x !== m) : [...s.marks, m] }; }
    else if (b.dataset.k) { const k = b.dataset.k as LookKey; const v = s.list(k).find(o => String(o.value) === b.dataset.v)?.value; draft = { ...draft, [k]: v } as Draft; }
    renderLook();
  });
  $("likeR").addEventListener("input", function (this: HTMLInputElement) {
    line = +this.value; const kin = family().kin ?? [];
    if (kin.length) draft = { ...draft, ...lookFromLine(kin, line, draft.familySeed ?? "") } as Draft;
    renderLook();
  });
  $("adult").addEventListener("click", () => {
    if (!adultAllowed()) return;
    adult = !adult; setPref("openworld.adult-content", String(adult));
    if (cloud && profile) void saveAdultMode(cloud, profile.id, adult).catch(() => undefined);
    setTimeout(renderSettings, 0);
  });
  $("person").addEventListener("click", e => { const b = (e.target as HTMLElement).closest("button"); if (!b) return; const i = qa($("person"), "button").indexOf(b as HTMLElement); const v = String(i + 1); if (isNarrationPerson(v)) { person = v; setPref("openworld.narration-person", v); } });
  $("lang").addEventListener("click", e => { const b = (e.target as HTMLElement).closest("button"); if (!b) return; lang = b.textContent!.trim() === "EN" ? "en" : "ru"; setPref("openworld.lang", lang); });
  $("aiProv").addEventListener("click", e => { const b = (e.target as HTMLElement).closest("button"); if (b) qa($("aiProv"), "button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); });
  $("aiGo").addEventListener("click", () => { void connectAi(); });
  const send = () => { const i = $("act") as HTMLInputElement; const t = i.value; i.value = ""; run(t); };
  ($("gamePhone").querySelector(".composer .send") as HTMLElement).addEventListener("click", send);
  $("act").addEventListener("keydown", e => { if ((e as KeyboardEvent).key === "Enter") { e.preventDefault(); send(); } });
  $("liveSheet").addEventListener("click", e => { const b = (e.target as HTMLElement).closest(".grid3 button"); if (b) live(b.textContent!.trim()); });
  $("mapInner").addEventListener("click", e => { const b = (e.target as HTMLElement).closest<HTMLElement>("[data-p]"); if (b) placeCard(b.dataset.p!); });
  $("pcX").addEventListener("click", () => { $("placeCard").hidden = true; });
  $("memS").querySelector(".search")!.addEventListener("input", e => { memQuery = (e.target as HTMLInputElement).value.trim(); renderMemory(); });
  $("worldS").addEventListener("click", e => { if ((e.target as HTMLElement).closest(".mapmini")) go("mapPhone"); }, true);
  app.addEventListener("click", e => {
    const target = e.target as HTMLElement;
    let t = target.closest<HTMLElement>("[data-act]"); if (t) { e.preventDefault(); act(t.dataset.act!, t); return; }
    t = target.closest<HTMLElement>("[data-go]"); if (t) { e.preventDefault(); if (t.hasAttribute("data-help")) setTimeout(() => { ($("aiHelp") as HTMLDetailsElement).open = true; }, 0); go(t.dataset.go!); return; }
    t = target.closest<HTMLElement>("[data-tab]"); if (t) { const id = t.dataset.tab!; if (stack[stack.length - 1] !== id) { stack = [id]; show(id); } return; }
    t = target.closest<HTMLElement>('[aria-label="Назад"]'); if (t) back();
  });
  if (cloud) {
    $("gBtn").addEventListener("click", e => { e.stopImmediatePropagation(); void signInWithGoogle(cloud).catch(() => undefined); }, true);
    void cloud.auth.getSession().then(async ({ data }) => { session = data.session; if (session) { await afterSignIn(); login(); } });
    cloud.auth.onAuthStateChange((_e, next) => { session = next; });
  }
}

(window as unknown as { OW: unknown }).OW = { go, back, login, logout };
init();
