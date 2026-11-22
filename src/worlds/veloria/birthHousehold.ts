/**
 * Семья под выбранное происхождение (0.16.0, «Новая жизнь в Велории»).
 *
 * Работает для всех шести держав и для старта с 0 до 12 лет. Из устойчивого seed собираются:
 * состав дома, достаток, родители, бабушки и дедушки, дядя или тётя по соседству, старшие и
 * младшие братья и сёстры, кормилица, у знатных домов прислуга. У каждого свой характер,
 * привычка, которую видно со стороны, и внешность по населению державы. Внешность героя
 * наследуется только от биологических родителей.
 *
 * Игрок видит только настоящее: ни одного слова о том, что с этими людьми случится.
 * Это сгенерированные люди, а не канон: в родословные великих домов они не входят.
 */
import { createAppearanceState } from "../../engine/appearance";
import type { LocationDef, NpcDef, NpcPersonality } from "../../engine/types";
import type { CharacterFamilyRecord } from "./family";
import type { AppearanceProfile, ParentHeritage } from "./heritage";
import { childOf } from "./nobleAppearance";
import { buildKin, lookFromLine, type KinElderInput, type KinMember } from "./kin";
import { MAP_NODES } from "./atlas";
import { POPULATIONS, regionalName, sampleNativeAppearance, sampleResidentAppearance, seedHash, type StateId } from "./populations";
import { birthOrigin, type BirthOrigin, type WealthHint, type WorkPlace } from "./birthOrigins";
import { settlementGateLocationId } from "./settlementMaps";

const CURRENT_YEAR = 742;
const MINUTES_PER_YEAR = 365 * 1440;
const WEALTH: WealthHint[] = ["бедно", "скромно", "в достатке"];

export type BirthHouseholdKind = "both-parents" | "with-grandparents" | "large-family" | "widowed-mother" | "unmarried-mother" | "mother-died" | "foundling";

export interface BirthPreviewMember {
  /** Откуда родом, если не из этого края (родительный падеж: «Сахрада»). */
  from?: string;
  id: string; name: string; role: string; age: number;
  temperament: string; appearance: string; occupation: string;
  livesWithYou: boolean; alive: boolean;
}
export interface BirthPreview {
  summary: string; home: string; wealth: WealthHint;
  members: BirthPreviewMember[];
  /** Друзья: соседские дети или дети приюта. Пусто для малышей до трёх лет. */
  friends: BirthPreviewMember[];
  suggestedName: string;
}

export interface BirthHousehold {
  origin: BirthOrigin;
  kind: BirthHouseholdKind;
  wealth: WealthHint;
  settlementId: string;
  homeId: string;
  locations: LocationDef[];
  /** Обратные выходы из уже существующих мест поселения к новым домам. */
  links: Array<{ from: string; to: string; distanceM: number }>;
  summary: string;
  members: NpcDef[];
  guardians: NpcDef[];
  biologicalParents: ParentHeritage[];
  /** Родные для шага «Внешность»: родители и их родители (0.19.0). */
  kin: KinMember[];
  record: CharacterFamilyRecord;
  appearance?: AppearanceProfile;
  preview: BirthPreview;
}

export interface BirthDraftLike { birthOriginId?: string; age: number; sex?: "male" | "female" | "unspecified"; familySeed?: string; name: string }

/** Перемешивание хэша: у похожих строк (одна семья, разные роли) значения не должны совпадать. */
function mix(h: number): number { h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return h >>> 0; }
const unit = (seed: string) => mix(seedHash(seed)) / 4294967296;
const between = (seed: string, min: number, max: number) => min + Math.floor(unit(seed) * (max - min + 1));
const chance = (seed: string, p: number) => unit(seed) < p;
/** Чем живут соседские семьи: у каждого соседского ребёнка свой родитель и ремесло. */
const NEIGHBOUR_TRADES = ["лодочника", "прачки", "бочара", "рыбака", "пекаря", "кузнеца", "ткачихи", "возчика", "сапожника", "горшечника", "плотника", "торговки зеленью"];
const FRIEND_QUIRKS = ["вечно куда-то убегает", "знает все лазы и задворки в округе", "любит животных и таскает домой котят", "много спрашивает и всё хочет потрогать", "задирается с другими детьми", "ходит хвостом за старшими", "лучше всех лазает по заборам", "собирает камешки и всякие находки", "любит страшные истории", "всегда делится едой"];
/** «родом из …»: страна в родительном падеже. */
const FROM: Record<string, string> = { estran: "Эстрана", sahrad: "Сахрада", tharvek: "Тарвека", varent: "Варента", elyndor: "Элиндора", kharum: "Кхарума" };
const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase("ru") + text.slice(1);
export const yearsWord = (n: number) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? "год" : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? "года" : "лет"; };

/** Где находится место поселения. В Ровене своя авторская карта. */
const ROVEN_PLACES: Record<string, string> = { square: "market-square", market: "lower-market", inn: "grey-fox", gate: "south-gate" };
function placeId(settlementId: string, at: WorkPlace, familyId: string): string {
  if (at === "home") return `birth:${familyId}:home`;
  if (at === "work") return `birth:${familyId}:work`;
  if (settlementId === "roven") return ROVEN_PLACES[at] ?? at;
  if (at === "gate") return settlementGateLocationId(settlementId);
  if (at === "square" || at === "market" || at === "inn") return `atlas:${settlementId}:${at}`;
  return `atlas:${settlementId}:square`;
}

function settlementKind(settlementId: string): "village" | "town" | "city" | "capital" | "port" {
  const kind = MAP_NODES.find(node => node.id === settlementId)?.kind;
  return kind === "port" || kind === "capital" || kind === "city" || kind === "village" ? kind : "town";
}

function pickKind(origin: BirthOrigin, seed: string): BirthHouseholdKind {
  if (origin.foundling) return "foundling";
  const g = origin.group;
  const table: Array<[BirthHouseholdKind, number]> = [
    ["both-parents", 42], ["with-grandparents", g === "малый дом" ? 30 : 20], ["large-family", g === "земля" ? 22 : g === "малый дом" ? 6 : 10],
    ["widowed-mother", g === "дно" ? 10 : 6], ["unmarried-mother", g === "дно" ? 12 : g === "малый дом" ? 1 : 5], ["mother-died", 4]
  ];
  const total = table.reduce((s, [, w]) => s + w, 0);
  let roll = unit(`${seed}:kind`) * total;
  for (const [kind, w] of table) { roll -= w; if (roll < 0) return kind; }
  return "both-parents";
}

function pickWealth(origin: BirthOrigin, seed: string): WealthHint {
  const base = WEALTH.indexOf(origin.wealthHint);
  void seed; // достаток всегда совпадает с меткой происхождения
  return WEALTH[base]!;
}

/** Характер: черты из seed, короткое слово для анкеты и одна привычка, которую видно со стороны. */
const QUIRKS: Record<string, string[]> = {
  parent: ["поёт за работой", "много молчит, но всё замечает", "ругается, когда устаёт", "любит рассказывать одни и те же истории", "встаёт раньше всех", "считает каждую монету", "смеётся громко и часто", "строго следит за порядком в доме", "легко обижается и долго помнит", "верит приметам"],
  elder: ["знает травы и старые песни", "любит поучать молодых", "почти не выходит из дома", "помнит всех соседей до третьего колена", "ворчит, но всех кормит", "молится утром и вечером"],
  child: ["вечно куда-то убегает", "дразнит младших", "ходит хвостом за старшими", "любит животных", "много спрашивает", "задирается с соседскими детьми"],
  staff: ["держится строго и по делу", "любит посплетничать", "работает быстро и без лишних слов", "говорит мало"]
};
type Sex = "male" | "female";
const adj = (m: string, sex: Sex) => sex === "male" ? m : m.replace(/(ый|ий|ой)$/, (end) => end === "ий" && /[кгхжшщч]ий$/.test(m) ? "ая" : end === "ий" ? "яя" : "ая");
const SIDE: Array<[keyof NpcPersonality["traits"], "high" | "low", string]> = [
  ["patience", "low", "вспыльчивый"], ["patience", "high", "терпеливый"], ["suspicion", "high", "недоверчивый"], ["discipline", "high", "строгий"],
  ["sociability", "high", "общительный"], ["sociability", "low", "нелюдимый"], ["pride", "high", "гордый"], ["openness", "high", "любопытный"],
  ["assertiveness", "high", "напористый"], ["assertiveness", "low", "робкий"], ["empathy", "high", "чуткий"], ["emotionalReactivity", "high", "обидчивый"], ["discipline", "low", "беспечный"]
];
function personality(seed: string, role: string, pool: keyof typeof QUIRKS, values: string[], sex: Sex, age: number): NpcPersonality & { word: string } {
  const t = {
    warmth: between(`${seed}:warmth`, 25, 92), sociability: between(`${seed}:soc`, 15, 88), assertiveness: between(`${seed}:as`, 20, 88),
    emotionalReactivity: between(`${seed}:emo`, 15, 88), patience: between(`${seed}:patience`, 20, 90), openness: between(`${seed}:op`, 15, 85),
    discipline: between(`${seed}:dis`, 25, 92), suspicion: between(`${seed}:sus`, 10, 78), empathy: between(`${seed}:emp`, 20, 90), pride: between(`${seed}:pr`, 10, 80)
  };
  if (age < 2) {
    const word = t.emotionalReactivity > 55 ? "беспокойный младенец" : "спокойный младенец";
    return { word: sex === "male" ? word : word.replace("ый", "ая").replace("младенец", "малышка"), temperament: `${role}: ${word}`, traits: t, values: [], formativeExperiences: [], copingPatterns: [], initialHabits: [] };
  }
  const warm = t.warmth > 68 ? "ласковый" : t.warmth > 46 ? "сдержанный" : "холодноватый";
  const side = [...SIDE].sort((a, b) => Math.abs(t[b[0]] - 50) * (b[1] === "high" ? (t[b[0]] > 50 ? 1 : 0) : (t[b[0]] < 50 ? 1 : 0)) - Math.abs(t[a[0]] - 50) * (a[1] === "high" ? (t[a[0]] > 50 ? 1 : 0) : (t[a[0]] < 50 ? 1 : 0)))[0]!;
  const word = `${adj(warm, sex)}, ${adj(side[2], sex)}`;
  const list = QUIRKS[pool]!;
  const quirk = list[mix(seedHash(`${seed}:quirk`)) % list.length]!;
  return {
    word, temperament: `${role}: ${word}; ${quirk}`, traits: t,
    values: [...values.slice(0, 2), ...(t.pride > 60 ? ["гордость"] : t.empathy > 65 ? ["забота о слабых"] : ["своя выгода"])],
    formativeExperiences: [], copingPatterns: [],
    initialHabits: [{ id: `quirk-${mix(seedHash(`${seed}:quirk`)) % 1000}`, label: quirk, trigger: "обычный день", strength: between(`${seed}:qs`, 50, 90) }]
  };
}

const SKIN = (tone: number) => tone <= 2 ? "очень светлая кожа" : tone <= 4 ? "светлая кожа" : tone <= 6 ? "смуглая кожа" : tone <= 8 ? "тёмная кожа" : "очень тёмная кожа";
const HAIR: Record<string, string> = { black: "чёрные", "dark-brown": "тёмно-каштановые", brown: "каштановые", auburn: "рыжевато-каштановые", red: "рыжие", blond: "русые", "light-blond": "светло-русые", grey: "седые", white: "белые" };
const TEXTURE: Record<string, string> = { straight: "прямые", wavy: "волнистые", curly: "кудрявые", coiled: "мелко вьющиеся" };
const EYES: Record<string, string> = { brown: "карие", "dark-brown": "тёмно-карие", hazel: "ореховые", green: "зелёные", blue: "голубые", grey: "серые", amber: "янтарные" };
const FACE: Record<string, string> = { soft: "мягкие черты лица", angular: "резкие скулы", broad: "широкое лицо", narrow: "узкое лицо", mixed: "смешанные черты лица", "east-asian": "восточные черты лица" };
/** Внешность словами, как её видно со стороны. */
export function describeLook(look: AppearanceProfile, age: number): string {
  const hair = age >= 60 ? `${TEXTURE[look.hairTexture]} волосы с сильной проседью` : age >= 45 ? `${HAIR[look.hairColor]} ${TEXTURE[look.hairTexture]} волосы с проседью` : `${HAIR[look.hairColor]} ${TEXTURE[look.hairTexture]} волосы`;
  return capitalize(`${hair}, ${EYES[look.eyeColor]} глаза, ${FACE[look.facialFeatures]}, ${SKIN(look.skinTone)}.`);
}

interface Spec { id: string; given: string; name: string; sex: "male" | "female"; age: number; look: AppearanceProfile; origin: StateId }

export function generateBirthHousehold(draft: BirthDraftLike, familyId: string, seed: string): BirthHousehold | { error: string } {
  const origin = birthOrigin(draft.birthOriginId);
  if (!origin) return { error: "Выбери, кем родиться." };
  if (origin.fixed) return { error: "Это каноническая судьба, её семья задана каноном." };
  const heroAge = draft.age;
  if (!Number.isInteger(heroAge) || heroAge < 0 || heroAge > 12) return { error: "Новая жизнь начинается с рождения или с возраста до 12 лет." };
  const state = origin.stateId;
  const s = origin.settlementId;
  const kindOfPlace = settlementKind(s);
  const pattern = POPULATIONS[state].names.pattern;
  const kind = pickKind(origin, seed);
  const wealth = pickWealth(origin, seed);
  const clothing = origin.group === "малый дом" ? "дорогая одежда из тонкой ткани"
    : wealth === "бедно" ? "заношенная, много раз чиненная одежда" : wealth === "скромно" ? "простая чистая одежда" : "добротная одежда из хорошей ткани";
  const taken = new Set<string>();
  const surname = regionalName(state, "male", `${seed}:family`).surname;

  /** Семья своего края. Пришлыми могут быть только мать (смешанный брак) и соседи; родня матери родом оттуда же, откуда она. */
  const person = (id: string, sex: "male" | "female", age: number, opts: { fatherGiven?: string; family?: string; from?: StateId; mixed?: boolean } = {}): Spec => {
    const originStateId: StateId = opts.from ?? (opts.mixed ? sampleResidentAppearance(state, `birth:${seed}:${id}`, kindOfPlace).originStateId : state);
    const look = sampleNativeAppearance(originStateId, `birth:${seed}:${id}`);
    let given = "";
    for (let attempt = 0; attempt < 16; attempt++) {
      given = regionalName(originStateId, sex, `birth:${seed}:${id}:${attempt}`).given;
      if (!taken.has(given)) break;
    }
    taken.add(given);
    const family = opts.family ?? surname;
    const name = pattern === "surname-given" ? `${family} ${given}`
      : pattern === "given-of-father" && opts.fatherGiven ? `${given} ${sex === "male" ? "ибн" : "бинт"} ${opts.fatherGiven} ${family}`
      : `${given} ${family}`;
    return { id, given, name, sex, age, look, origin: originStateId };
  };

  const homeId = origin.settlementId === "roven" && origin.foundling ? "temple" : placeId(s, "home", familyId);
  const workId = origin.work ? placeId(s, "work", familyId) : undefined;
  const near = placeId(s, origin.home.near ?? "square", familyId);
  const square = placeId(s, "square", familyId);
  const locations: LocationDef[] = [];
  const links: BirthHousehold["links"] = [];
  if (homeId !== "temple") {
    locations.push({ id: homeId, name: origin.home.name, description: origin.home.description, exits: [{ to: near, distanceM: 150, terrain: "street" }, ...(workId ? [{ to: workId, distanceM: 300, terrain: "street" as const }] : [])] });
    links.push({ from: near, to: homeId, distanceM: 150 });
  }
  if (workId && origin.work) {
    locations.push({ id: workId, name: origin.work.name, description: origin.work.description, exits: [{ to: square, distanceM: 350, terrain: "street" }, { to: homeId, distanceM: 300, terrain: "street" }] });
    links.push({ from: square, to: workId, distanceM: 350 });
  }

  const members: NpcDef[] = [];
  const guardians: NpcDef[] = [];
  const biologicalParents: ParentHeritage[] = [];
  const elders: KinElderInput[] = [];
  const preview: BirthPreviewMember[] = [];
  const add = (spec: Spec, role: string, p: ReturnType<typeof personality>, extra: Partial<NpcDef>, occupation: string, livesWithYou = true, dress: string = clothing) => {
    const { word, ...pers } = p;
    // Свой день рождения: возраст растёт в этот день, а не у всех разом в Новый год.
    const birthdayOffset = Math.floor(unit(`${seed}:birthday:${spec.id}`) * 365);
    const bornAtMinute = -spec.age * MINUTES_PER_YEAR - birthdayOffset * 1440;
    const npc: NpcDef = {
      id: spec.id, name: spec.name, homeId: extra.homeId ?? homeId, age: spec.age, birthYear: CURRENT_YEAR - spec.age - (birthdayOffset > 0 ? 1 : 0), bornAtMinute, lifeStatus: "alive",
      roleTags: [origin.group === "малый дом" && extra.familyRole !== "other" ? "noble" : "commoner"], goals: ["содержать дом и близких"],
      originStateId: spec.origin, schedule: [], personality: pers,
      appearance: createAppearanceState({ skinTone: spec.look.skinTone, naturalHairColor: spec.look.hairColor, hairTexture: spec.look.hairTexture, eyeColor: spec.look.eyeColor, facialFeatures: spec.look.facialFeatures },
        { hairstyle: spec.sex === "male" ? "коротко подстриженные волосы" : "волосы убраны от лица", clothing: dress }),
      ...extra
    };
    if (!npc.about && occupation) npc.about = `${capitalize(occupation)}.`;
    members.push(npc);
    const alive = npc.lifeStatus === "alive";
    const quirk = pers.initialHabits[0]?.label;
    preview.push({ id: spec.id, name: spec.name, role, age: spec.age, temperament: alive ? capitalize(`${word}${quirk ? `, ${quirk}` : ""}`) : "", appearance: alive ? describeLook(spec.look, spec.age) : "", occupation: alive ? occupation : "", livesWithYou: alive && livesWithYou, alive, ...(spec.origin !== state ? { from: FROM[spec.origin] } : {}) });
    return npc;
  };
  const day = (at: string, activity: string, from = 6, to = 18) => from === 0 && to === 24 ? [{ from: 0, to: 24, locationId: at, activity }]
    : [{ from: 0, to: from, locationId: homeId, activity: "спит дома" }, { from, to, locationId: at, activity }, { from: to, to: 24, locationId: homeId, activity: "дома с семьёй" }];

  const friendsPreview: BirthPreviewMember[] = [];
  /** Соседские дети примерно того же возраста: живут своими семьями, днём играют рядом. */
  const addFriends = (playAt: string, livingAt: string, inShelter: boolean) => {
    if (heroAge < 3) return;
    const count = between(`${seed}:friends`, 1, heroAge >= 6 ? 3 : 2);
    for (let i = 0; i < count; i++) {
      const sex = chance(`${seed}:friend-sex:${i}`, 0.5) ? "male" as const : "female" as const;
      const age = Math.max(2, Math.min(14, heroAge + between(`${seed}:friend-age:${i}`, -2, 2)));
      let famName = regionalName(state, "male", `${seed}:friend-family:${i}`).surname;
      const f = person(`${familyId}-friend-${i + 1}`, sex, age, { mixed: !inShelter, family: inShelter ? "" : famName, fatherGiven: regionalName(state, "male", `${seed}:friend-father:${i}`).given });
      if (inShelter) f.name = f.given;
      // Пришлая семья носит фамилию своего края.
      else if (f.origin !== state) { famName = regionalName(f.origin, "male", `${seed}:friend-family:${i}`).surname; f.name = `${f.given} ${famName}`; }
      const role = inShelter ? (sex === "male" ? "мальчик из приюта" : "девочка из приюта") : (sex === "male" ? "соседский мальчик" : "соседская девочка");
      const before = preview.length;
      const base = personality(`${seed}:friend:${i}`, role, "child", ["игры", "дружба"], sex, age);
      // У каждого соседского ребёнка своя привычка, чтобы их можно было различить.
      const quirk = FRIEND_QUIRKS[(between(`${seed}:friend-quirk`, 0, FRIEND_QUIRKS.length - 1) + i * 5) % FRIEND_QUIRKS.length]!;
      const fp = { ...base, temperament: `${role}: ${base.word}; ${quirk}`, initialHabits: base.initialHabits.length ? [{ ...base.initialHabits[0]!, label: quirk }] : [] };
      const trait = capitalize(`${fp.word}${fp.initialHabits[0] ? `, ${quirk}` : ""}.`);
      const trade = NEIGHBOUR_TRADES[Math.floor(unit(`${seed}:friend-trade:${i}`) * NEIGHBOUR_TRADES.length)]!;
      const about = inShelter
        ? `${sex === "male" ? "Попал" : "Попала"} в приют совсем ${sex === "male" ? "маленьким" : "маленькой"}, растёте под одной крышей. ${trait}`
        : `${sex === "male" ? "Сын" : "Дочь"} ${trade} ${famName}, живут по соседству${f.origin !== state ? `, семья родом из ${FROM[f.origin]}` : ""}. ${trait}`;
      add(f, role, fp, {
        familyRole: "other", homeId: livingAt, about,
        schedule: inShelter ? [{ from: 0, to: 24, locationId: livingAt, activity: "живёт и учится в приюте" }]
          : [{ from: 0, to: 9, locationId: livingAt, activity: "дома" }, { from: 9, to: 17, locationId: playAt, activity: "играет с соседскими детьми" }, { from: 17, to: 24, locationId: livingAt, activity: "дома" }]
      }, inShelter ? "живёт в приюте" : "играет во дворе по соседству", inShelter, inShelter ? "одинаковая приютская одежда" : undefined);
      friendsPreview.push(...preview.splice(before));
    }
  };

  // Подкидыш: растят служители веры, кормит приходящая кормилица, рядом другие дети приюта.
  if (kind === "foundling" && origin.foundling) {
    const f = origin.foundling;
    const g = person(`${familyId}-guardian`, "female", between(`${seed}:guardian`, 28, 58), { family: "" });
    g.name = `${f.guardianTitle} ${g.given}`;
    const gn = add(g, f.guardianRole, personality(`${seed}:guardian`, f.guardianRole, "staff", origin.values, "female", g.age), {
      familyRole: "guardian", roleTags: ["clergy"], about: `${capitalize(f.guardianRole)}. Служит в приюте, учит и присматривает за детьми, которых оставили на попечение веры; растит и тебя с младенчества.`, caregiving: { role: "guardian", canFeed: false }, schedule: [{ from: 0, to: 24, locationId: homeId, activity: "служит в приюте и присматривает за детьми" }]
    }, "служит в приюте, присматривает за детьми", true, f.clothing);
    guardians.push(gn);
    if (heroAge < 2) {
      const n = person(`${familyId}-wet-nurse`, "female", between(`${seed}:nurse`, 19, 34), { family: regionalName(state, "male", `${seed}:nurse-family`).surname });
      add(n, "кормилица", personality(`${seed}:nurse`, "кормилица", "staff", ["свои дети", "заработок"], "female", n.age), {
        familyRole: "other", homeId: square, about: "Женщина из округи, у неё свой малыш. Несколько раз в день приходит в приют кормить младенцев.", caregiving: { role: "wet-nurse", canFeed: true },
        schedule: [{ from: 6, to: 9, locationId: homeId, activity: "кормит младенцев приюта" }, { from: 12, to: 14, locationId: homeId, activity: "кормит младенцев приюта" }, { from: 18, to: 21, locationId: homeId, activity: "кормит младенцев приюта" }]
      }, "приходит кормить младенцев", false, "простое платье и фартук");
    }
    addFriends(homeId, homeId, true);
    const summary = `Тебя оставили младенцем: ${origin.home.name.toLocaleLowerCase("ru")}. Кто твои родители, неизвестно. Растит тебя ${g.name}.${heroAge > 0 ? ` Тебе ${heroAge} ${yearsWord(heroAge)}.` : ""}`;
    return {
      origin, kind, wealth: "бедно", settlementId: s, homeId, locations, links, members, guardians, biologicalParents, kin: [], summary,
      record: {
        characterId: `player:${familyId}`, birthYear: CURRENT_YEAR - heroAge, biologicalParentIds: [], biologicalParentage: "unknown", legalParentIds: [], legalParentage: "unknown",
        guardianIds: [gn.id, f.institutionId], birthStatus: "unknown", parentalUnion: { status: "unknown" }, recognitions: [],
        succession: { status: "undetermined", basis: "Происхождение подкидыша неизвестно." }
      },
      preview: { summary, home: origin.home.name, wealth: "бедно", members: preview, friends: friendsPreview, suggestedName: regionalName(state, draft.sex === "female" ? "female" : "male", `${seed}:hero`).given }
    };
  }

  // Родители.
  const motherAtBirth = origin.group === "малый дом" ? between(`${seed}:mother-age`, 18, 32) : between(`${seed}:mother-age`, 17, 36);
  const motherAge = motherAtBirth + heroAge;
  const fatherAge = Math.min(70, motherAge + between(`${seed}:gap`, 0, 9));
  const fatherKnown = kind !== "unmarried-mother";
  const motherAlive = kind !== "mother-died";
  const fatherAlive = fatherKnown && kind !== "widowed-mother";
  const father = person(`${familyId}-parent-a`, "male", fatherAge);
  const mother = person(`${familyId}-parent-b`, "female", motherAge, { mixed: true, family: pattern === "given-of-father" ? [0, 1, 2, 3, 4, 5].map(i => regionalName(state, "male", `${seed}:mother-family${i ? `:${i}` : ""}`).surname).find(n => n !== surname) ?? surname : undefined });
  // Девичья фамилия матери: её носят родня по матери. Если отец неизвестен, у матери и ребёнка одна фамилия.
  let maiden = !fatherKnown ? surname : pattern === "given-of-father" ? mother.name.split(" ").slice(-1)[0]! : regionalName(mother.origin, "male", `${seed}:mother-family`).surname;
  for (let i = 1; fatherKnown && maiden === surname && i < 12; i++) maiden = regionalName(mother.origin, "male", `${seed}:mother-family:${i}`).surname;
  const motherFrom = mother.origin !== state ? ` Родом из ${FROM[mother.origin]}.` : "";
  // В Сахраде отчество отца героя: имя деда.
  let grandfatherGiven = regionalName(state, "male", `${seed}:grandfather-given`).given;
  for (let i = 1; grandfatherGiven === father.given && i < 12; i++) grandfatherGiven = regionalName(state, "male", `${seed}:grandfather-given:${i}`).given;
  if (pattern === "given-of-father") father.name = `${father.given} ибн ${grandfatherGiven} ${surname}`;

  const motherWorksAt = placeId(s, origin.mother.at, familyId);
  const infantCare = heroAge < 1;
  const mNpc = add(mother, motherAlive ? "мать" : "мать, умерла при твоих родах", personality(`${seed}:mother`, "мать", "parent", origin.values, "female", mother.age), {
    familyRole: "biological-parent", lifeStatus: motherAlive ? "alive" : "dead",  about: motherAlive ? `${capitalize(infantCare ? "сейчас ухаживает за тобой и ведёт хозяйство" : origin.mother.activity)}.${motherFrom}` : `Умерла, когда ты ${draft.sex === "female" ? "появилась" : "появился"} на свет. Её помнят по рассказам родных.`,
    caregiving: motherAlive ? { role: "mother", canFeed: heroAge < 2 } : undefined,
    schedule: !motherAlive ? [] : infantCare || motherWorksAt === homeId ? [{ from: 0, to: 24, locationId: homeId, activity: infantCare ? "ухаживает за младенцем и ведёт хозяйство" : origin.mother.activity }] : day(motherWorksAt, origin.mother.activity, 7, 17)
  }, infantCare ? "ухаживает за младенцем" : origin.mother.activity);
  biologicalParents.push({ id: mother.id, name: mother.name, appearance: mother.look });
  if (fatherKnown) {
    const at = placeId(s, origin.father.at, familyId);
    add(father, fatherAlive ? "отец" : "отец, умер до твоего рождения", personality(`${seed}:father`, "отец", "parent", origin.values, "male", father.age), {
      familyRole: "biological-parent", lifeStatus: fatherAlive ? "alive" : "dead", about: fatherAlive ? `${capitalize(origin.father.activity)}. На нём держится дом.` : "Умер до твоего рождения. О нём знаешь только по рассказам.", caregiving: fatherAlive ? { role: "father", canFeed: false } : undefined,
      schedule: fatherAlive ? (at === homeId ? [{ from: 0, to: 24, locationId: homeId, activity: origin.father.activity }] : day(at, origin.father.activity)) : []
    }, origin.father.activity);
    biologicalParents.push({ id: father.id, name: father.name, appearance: father.look });
  }
  const parentGiven = fatherKnown ? father.given : mother.given;

  // Бабушки и дедушки: живут с семьёй, если так сложился дом, или если мать умерла.
  const withElders = kind === "with-grandparents" || kind === "mother-died" || (kind === "widowed-mother" && chance(`${seed}:widow-gran`, 0.5));
  if (withElders) {
    const paternal = fatherKnown && chance(`${seed}:gran-side`, 0.55);
    const base = paternal ? fatherAge : motherAge;
    const granAge = base + between(`${seed}:gran`, 19, 28);
    if (granAge <= 82) {
      const gran = person(`${familyId}-grandmother`, "female", granAge, { family: paternal ? surname : maiden, ...(paternal ? {} : { from: mother.origin }) });
      const gNpc = add(gran, paternal ? "бабушка, мать отца" : "бабушка, мать матери", personality(`${seed}:gran`, "бабушка", "elder", origin.values, "female", gran.age), {
        familyRole: "other", about: `Живёт с вами, нянчит внуков и ведёт хозяйство. Помнит, как жила семья ${paternal ? "отца" : "матери"} до тебя.`, caregiving: { role: "relative", canFeed: false }, schedule: [{ from: 0, to: 24, locationId: homeId, activity: "нянчит внуков и ведёт хозяйство" }]
      }, "нянчит внуков, ведёт хозяйство");
      guardians.push(gNpc);
      elders.push({ id: gran.id, given: gran.given, sex: "female", side: paternal ? "father" : "mother", look: gran.look });
      const grandpaAge = granAge + between(`${seed}:grandpa-gap`, 0, 6);
      if (grandpaAge <= 80 && chance(`${seed}:grandpa`, 0.4)) {
        const gp = person(`${familyId}-grandfather`, "male", grandpaAge, { family: paternal ? surname : maiden, ...(paternal ? {} : { from: mother.origin }) });
        if (paternal && pattern === "given-of-father") gp.name = `${grandfatherGiven} ${surname}`;
        elders.push({ id: gp.id, given: paternal && pattern === "given-of-father" ? grandfatherGiven : gp.given, sex: "male", side: paternal ? "father" : "mother", look: gp.look });
        add(gp, paternal ? "дедушка, отец отца" : "дедушка, отец матери", personality(`${seed}:grandpa`, "дедушка", "elder", origin.values, "male", gp.age), {
          familyRole: "other", about: "Живёт с вами. Чинит утварь, сидит у очага и помогает по дому, как позволяют силы.", caregiving: { role: "relative", canFeed: false }, schedule: [{ from: 0, to: 24, locationId: homeId, activity: "чинит утварь и сидит у очага" }]
        }, "помогает по дому, как позволяют силы");
      }
    }
  }

  // Кормилица: только для младенца без матери.
  if (!motherAlive && heroAge < 2) {
    const n = person(`${familyId}-wet-nurse`, "female", between(`${seed}:nurse`, 19, 34), { family: regionalName(state, "male", `${seed}:nurse-family`).surname });
    add(n, "кормилица", personality(`${seed}:nurse`, "кормилица", "staff", ["свои дети", "заработок"], "female", n.age), {
      familyRole: "other", homeId: near, about: "Соседка, у неё свой малыш. Приходит несколько раз в день кормить тебя.", caregiving: { role: "wet-nurse", canFeed: true },
      schedule: [{ from: 6, to: 9, locationId: homeId, activity: "кормит младенца" }, { from: 12, to: 14, locationId: homeId, activity: "кормит младенца" }, { from: 18, to: 22, locationId: homeId, activity: "кормит младенца" }]
    }, "приходит кормить тебя", false, "простое платье и фартук");
  }

  // Прислуга знатного дома.
  if (origin.servants) {
    const nanny = person(`${familyId}-nanny`, "female", between(`${seed}:nanny`, 30, 58), { family: regionalName(state, "male", `${seed}:nanny-family`).surname });
    add(nanny, "няня", personality(`${seed}:nanny`, "няня", "staff", ["место в доме", "дети господ"], "female", nanny.age), {
      familyRole: "other", about: "Служит в доме няней: присматривает за детьми господ, знает все порядки дома.", caregiving: { role: "nanny", canFeed: false }, schedule: [{ from: 0, to: 24, locationId: homeId, activity: "присматривает за детьми господ" }]
    }, "присматривает за детьми", true, "тёмное платье прислуги");
    const steward = person(`${familyId}-steward`, "male", between(`${seed}:steward`, 35, 62), { family: regionalName(state, "male", `${seed}:steward-family`).surname });
    add(steward, "управляющий", personality(`${seed}:steward`, "управляющий", "staff", ["порядок в доме", "своя выгода"], "male", steward.age), {
      familyRole: "other", about: "Управляет домом: ведёт счета, распоряжается прислугой и закупками.", schedule: day(homeId, "ведёт хозяйство и счета дома", 6, 20)
    }, "ведёт хозяйство и счета дома", true, "строгий кафтан управляющего");
  }

  // Старшие братья и сёстры: не раньше 17 лет матери, с промежутком от двух лет.
  const relatives: string[] = [];
  const childSchedule = (age: number) => age >= 8 && fatherAlive
    ? [{ from: 0, to: 7, locationId: homeId, activity: "спит" }, { from: 7, to: 14, locationId: placeId(s, origin.father.at, familyId), activity: "помогает взрослым с работой" }, { from: 14, to: 24, locationId: homeId, activity: "дома" }]
    : [{ from: 0, to: 24, locationId: homeId, activity: age < 3 ? "играет и спит дома" : "играет дома и во дворе" }];
  const childLook = (i: string) => fatherKnown ? childOf(mother.look, father.look, `${seed}:sib-look:${i}`) : childOf(mother.look, mother.look, `${seed}:sib-look:${i}`);
  const maxOlder = kind === "large-family" ? 5 : kind === "unmarried-mother" || kind === "widowed-mother" ? 1 : 2;
  const wantedOlder = between(`${seed}:siblings`, kind === "large-family" ? 3 : 0, maxOlder);
  let gap = between(`${seed}:sib-gap`, 2, 3);
  for (let i = 0; i < wantedOlder && motherAtBirth - gap >= 17; i++) {
    const sex = chance(`${seed}:sib-sex:${i}`, 0.5) ? "male" as const : "female" as const;
    const age = heroAge + gap;
    const sib = person(`${familyId}-sibling-${i + 1}`, sex, age, { fatherGiven: parentGiven });
    sib.look = childLook(`${i}`);
    add(sib, sex === "male" ? "старший брат" : "старшая сестра", personality(`${seed}:sib:${i}`, sex === "male" ? "старший брат" : "старшая сестра", age >= 16 ? "parent" : "child", origin.values, sex, age), {
      familyRole: "other", about: age >= 16 ? "Почти взрослый, работает наравне со старшими." : age >= 8 ? "Помогает взрослым по хозяйству и в работе, присматривает за младшими." : "Ещё мал, играет дома и во дворе.", caregiving: age >= 8 ? { role: "relative", canFeed: false } : undefined, schedule: childSchedule(age)
    }, age >= 8 ? "помогает взрослым" : "играет дома");
    relatives.push(`${sib.given} (${age} ${yearsWord(age)})`);
    gap += between(`${seed}:sib-gap:${i}`, 2, 4);
  }
  // Младшие: только если мать жива и герою хотя бы два года.
  const younger: string[] = [];
  if (motherAlive && heroAge >= 2 && kind !== "widowed-mother") {
    const wantedYounger = between(`${seed}:younger`, 0, heroAge >= 6 ? 2 : 1);
    let age = heroAge - between(`${seed}:young-gap`, 2, 3);
    for (let i = 0; i < wantedYounger && age >= 0 && motherAge - (heroAge - age) <= 42; i++) {
      const sex = chance(`${seed}:young-sex:${i}`, 0.5) ? "male" as const : "female" as const;
      const sib = person(`${familyId}-younger-${i + 1}`, sex, age, { fatherGiven: parentGiven });
      sib.look = childLook(`y${i}`);
      add(sib, sex === "male" ? "младший брат" : "младшая сестра", personality(`${seed}:young:${i}`, sex === "male" ? "младший брат" : "младшая сестра", "child", origin.values, sex, age), {
        familyRole: "other", schedule: childSchedule(age)
      }, age < 2 ? "малыш, всё время рядом со взрослыми" : "играет дома");
      younger.push(`${sib.given} (${age < 1 ? "младенец" : `${age} ${yearsWord(age)}`})`);
      age -= between(`${seed}:young-gap:${i}`, 2, 3);
    }
  }

  // Дядя или тётя живут в том же поселении, но своим домом.
  if (chance(`${seed}:uncle`, 0.45)) {
    const sex = chance(`${seed}:uncle-sex`, 0.5) ? "male" as const : "female" as const;
    const sideFather = fatherKnown && chance(`${seed}:uncle-side`, 0.5);
    const base = sideFather ? fatherAge : motherAge;
    const u = person(`${familyId}-${sex === "male" ? "uncle" : "aunt"}`, sex, Math.max(16, base + between(`${seed}:uncle-age`, -8, 8)), { ...(sideFather ? {} : { from: mother.origin }), family: sideFather ? surname : maiden, fatherGiven: sideFather ? grandfatherGiven : undefined });
    const role = `${sex === "male" ? "дядя" : "тётя"}, ${sex === "male" ? "брат" : "сестра"} ${sideFather ? "отца" : "матери"}`;
    const work = sex === "male" ? "работает в поселении" : "держит своё хозяйство по соседству";
    const at = placeId(s, chance(`${seed}:uncle-at`, 0.5) ? "market" : "square", familyId);
    add(u, role, personality(`${seed}:uncle`, sex === "male" ? "дядя" : "тётя", "parent", origin.values, sex, u.age), {
      familyRole: "other", homeId: near, about: `${capitalize(work)}, живёт своим домом неподалёку. По вечерам заходит к родне.`, schedule: [{ from: 8, to: 18, locationId: at, activity: work }, { from: 18, to: 20, locationId: homeId, activity: "заходит в гости к родне" }]
    }, work, false);
  }

  addFriends(homeId === near ? square : near, near, false);

  const kin = buildKin([
    { id: mother.id, given: mother.given, sex: "female", look: mother.look, alive: motherAlive, state: mother.origin },
    ...(fatherKnown ? [{ id: father.id, given: father.given, sex: "male" as const, look: father.look, alive: fatherAlive, state: father.origin }] : [])
  ], elders, `${seed}:kin`);
  // Варианты бабушек и дедушек входят в наследуемые варианты родителя.
  for (const parent of biologicalParents) {
    const side = parent.id === mother.id ? "mother" : "father";
    const olds = kin.filter(k => k.side === side && k.relation !== "мама" && k.relation !== "папа");
    const tones = olds.map(k => k.look.skinTone);
    parent.familyVariants = {
      skinToneRange: tones.length ? [Math.min(...tones), Math.max(...tones)] as [typeof tones[number], typeof tones[number]] : undefined,
      hairColors: olds.map(k => k.look.hairColor), hairTextures: olds.map(k => k.look.hairTexture), eyeColors: olds.map(k => k.look.eyeColor), facialFeatures: olds.map(k => k.look.facialFeatures)
    };
  }
  const line = lookFromLine(kin, 50, `${seed}:child`);
  const childAppearance = kin.length ? { skinTone: line.skinTone, hairColor: line.hairColor, hairTexture: line.hairTexture, eyeColor: line.eyeColor, facialFeatures: line.facialFeatures } : fatherKnown ? childOf(mother.look, father.look, `${seed}:child`) : childOf(mother.look, mother.look, `${seed}:child`);
  const houseText: Record<Exclude<BirthHouseholdKind, "foundling">, string> = {
    "both-parents": "мать и отец растят тебя вместе",
    "with-grandparents": "родители и старшие родные живут одним домом",
    "large-family": "большая семья, в доме тесно и шумно",
    "widowed-mother": "отец умер до твоего рождения, мать растит тебя одна",
    "unmarried-mother": "мать не замужем; кто отец, в семье не говорят",
    "mother-died": "мать умерла при родах; растят отец и бабушка"
  };
  const living = members.filter(m => m.lifeStatus === "alive" && m.homeId === homeId).length;
  const summary = [
    `${capitalize(houseText[kind as Exclude<BirthHouseholdKind, "foundling">])}.`,
    `Дом: ${origin.home.name.toLocaleLowerCase("ru")}, ${MAP_NODES.find(n => n.id === s)?.name ?? s}.`,
    `Живёте ${wealth}.`,
    relatives.length ? `Старшие: ${relatives.join(", ")}.` : younger.length ? "Ты старший ребёнок." : "Ты первый ребёнок в семье.",
    younger.length ? `Младшие: ${younger.join(", ")}.` : "",
    living > 6 ? "Под одной крышей много людей." : ""
  ].filter(Boolean).join(" ");
  const sex = draft.sex === "female" ? "female" : "male";
  const hero = regionalName(state, sex, `${seed}:hero`, surname, parentGiven);
  const parentIds = biologicalParents.map(p => p.id);
  const noble = origin.statusId === "noble";
  return {
    origin, kind, wealth, settlementId: s, homeId, locations, links, members, guardians, biologicalParents, kin, appearance: childAppearance, summary,
    record: {
      characterId: `player:${familyId}`, birthYear: CURRENT_YEAR - heroAge,
      biologicalParentIds: parentIds, biologicalParentage: parentIds.length === 2 ? "both-known" : "one-known",
      legalParentIds: kind === "unmarried-mother" ? [mother.id] : parentIds, legalParentage: kind === "unmarried-mother" || parentIds.length === 1 ? "one-known" : "both-known",
      guardianIds: guardians.map(g => g.id), birthStatus: kind === "unmarried-mother" ? "unrecognized" : "legitimate",
      parentalUnion: { status: kind === "unmarried-mother" ? "unmarried" : "married" }, recognitions: [],
      succession: { status: "undetermined", basis: noble ? "Малый род: право наследования определяется обычаем державы и старшинством детей." : "Простолюдинская семья: наследство по местному обычаю." }
    },
    preview: { summary, home: origin.home.name, wealth, members: preview, friends: friendsPreview, suggestedName: pattern === "surname-given" ? hero.given : hero.given }
  };
}
