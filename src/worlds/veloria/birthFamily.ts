/**
 * Рождение в обычной семье Ровена (0.14.0).
 *
 * Мир сам собирает семью новорождённого из устойчивого seed анкеты: состав дома, достаток,
 * возраст и характер родителей, старшие братья и сёстры, бабушка, кормилица. Одна и та же
 * анкета всегда даёт ту же семью; другой seed: другую. Внешность родителей берётся из населения
 * Эстрана (иногда родитель приезжий), внешность ребёнка: только от них.
 *
 * Это сгенерированная семья, а не канон: никто из этих людей не входит в родословные домов.
 */
import { createAppearanceState } from "../../engine/appearance";
import type { NpcDef, NpcPersonality } from "../../engine/types";
import type { VeloriaCharacterDraft, VeloriaOriginId } from "./character";
import type { CharacterFamilyRecord } from "./family";
import type { AppearanceProfile, ParentHeritage } from "./heritage";
import { childOf } from "./nobleAppearance";
import { regionalName, sampleResidentAppearance, seedHash, type StateId } from "./populations";

const CURRENT_YEAR = 742;

/** Происхождения, с которых можно начать новорождённым в обычной семье. */
export const NEWBORN_ORIGINS: VeloriaOriginId[] = ["tenant-farmer", "free-farmer", "craft-apprentice", "merchant-child", "small-trader", "caravan-hand", "temple-orphan"];

export const NEWBORN_ORIGIN_LABELS: Partial<Record<VeloriaOriginId, string>> = {
  "tenant-farmer": "семья арендаторов", "free-farmer": "семья свободных земледельцев", "craft-apprentice": "семья ремесленника",
  "merchant-child": "торговая семья", "small-trader": "семья мелкого торговца", "caravan-hand": "семья возчиков", "temple-orphan": "подкидыш у храма"
};

export type HouseholdKind = "both-parents" | "with-grandmother" | "large-family" | "widowed-mother" | "unmarried-mother" | "mother-died" | "foundling";
export type Wealth = "бедно" | "скромно" | "в достатке";

export const HOUSEHOLD_LABELS: Record<HouseholdKind, string> = {
  "both-parents": "мать и отец растят вас вместе",
  "with-grandmother": "родители и бабушка живут одним домом",
  "large-family": "большая семья: у вас много старших братьев и сестёр",
  "widowed-mother": "отец умер до вашего рождения, мать растит вас одна",
  "unmarried-mother": "мать не замужем; кто отец, в семье не говорят",
  "mother-died": "мать умерла при родах; растят отец, бабушка и кормилица",
  "foundling": "вас оставили у храма Семерых; растят храмовые сёстры"
};

export interface NewbornHousehold {
  kind: HouseholdKind;
  wealth: Wealth;
  homeId: string;
  /** Что игрок видит в анкете до старта. */
  summary: string;
  members: NpcDef[];
  biologicalParents: ParentHeritage[];
  guardians: NpcDef[];
  record: CharacterFamilyRecord;
  appearance?: AppearanceProfile;
}

const unit = (seed: string) => seedHash(seed) / 4294967296;
const between = (seed: string, min: number, max: number) => min + Math.floor(unit(seed) * (max - min + 1));

function pickKind(origin: VeloriaOriginId, seed: string): HouseholdKind {
  if (origin === "temple-orphan") return "foundling";
  const farm = origin === "tenant-farmer" || origin === "free-farmer";
  const table: Array<[HouseholdKind, number]> = [
    ["both-parents", 45], ["with-grandmother", 18], ["large-family", farm ? 20 : 8],
    ["widowed-mother", 7], ["unmarried-mother", 6], ["mother-died", 4]
  ];
  const total = table.reduce((s, [, w]) => s + w, 0);
  let roll = unit(`${seed}:kind`) * total;
  for (const [kind, w] of table) { roll -= w; if (roll < 0) return kind; }
  return "both-parents";
}

function pickWealth(origin: VeloriaOriginId, seed: string): Wealth {
  const base = origin === "merchant-child" ? 2 : origin === "tenant-farmer" || origin === "caravan-hand" || origin === "temple-orphan" ? 0 : 1;
  const shift = unit(`${seed}:wealth`) < 0.2 ? -1 : unit(`${seed}:wealth`) > 0.85 ? 1 : 0;
  return (["бедно", "скромно", "в достатке"] as const)[Math.max(0, Math.min(2, base + shift))]!;
}

function homeFor(origin: VeloriaOriginId): string {
  if (origin === "tenant-farmer" || origin === "free-farmer") return "mill-road";
  if (origin === "craft-apprentice") return "old-quarter";
  if (origin === "merchant-child" || origin === "small-trader") return "lower-market";
  if (origin === "caravan-hand") return "river-dock";
  return "temple";
}

function workFor(origin: VeloriaOriginId): { locationId: string; activity: string } {
  if (origin === "tenant-farmer" || origin === "free-farmer") return { locationId: "mill-road", activity: "работает в поле и на мельнице" };
  if (origin === "craft-apprentice") return { locationId: "smithy", activity: "работает в мастерской" };
  if (origin === "merchant-child" || origin === "small-trader") return { locationId: "lower-market", activity: "торгует на рынке" };
  return { locationId: "river-dock", activity: "грузит обозы у пристани" };
}

/** Характер взрослого члена семьи: от сурового до очень тёплого. Влияет на уход за ребёнком. */
function familyPersonality(seed: string, role: string): NpcPersonality {
  const warmth = between(`${seed}:warmth`, 30, 92);
  const patience = between(`${seed}:patience`, 25, 90);
  const temperament = warmth > 70 ? (patience > 60 ? "ласковый и терпеливый" : "ласковый, но вспыльчивый")
    : warmth > 50 ? (patience > 60 ? "спокойный и сдержанный" : "строгий и уставший")
    : (patience > 60 ? "холодноватый, но надёжный" : "резкий и раздражительный");
  return {
    temperament: `${role}: ${temperament}`,
    traits: { warmth, sociability: between(`${seed}:soc`, 20, 85), assertiveness: between(`${seed}:as`, 25, 85), emotionalReactivity: between(`${seed}:emo`, 20, 85), patience, openness: between(`${seed}:op`, 20, 80), discipline: between(`${seed}:dis`, 30, 90), suspicion: between(`${seed}:sus`, 15, 70), empathy: between(`${seed}:emp`, 30, 90), pride: between(`${seed}:pr`, 15, 75) },
    values: ["семья", "хлеб на столе"], formativeExperiences: [], copingPatterns: [], initialHabits: []
  };
}

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase("ru") + text.slice(1);

interface PersonSpec { id: string; name: string; sex: "male" | "female"; age: number; look: AppearanceProfile; origin: StateId }

/** Имена внутри одной семьи не повторяются: мать и бабушка не могут обе зваться «Мэйбл». */
function person(seed: string, id: string, sex: "male" | "female", age: number, surname: string, taken: Set<string> = new Set()): PersonSpec {
  const { originStateId, ...look } = sampleResidentAppearance("estran", `birth:${seed}:${id}`, "city");
  let name = "";
  for (let attempt = 0; attempt < 12; attempt++) {
    const key = attempt ? `birth:${seed}:${id}:${attempt}` : `birth:${seed}:${id}`;
    const given = originStateId === "estran" ? regionalName("estran", sex, key, surname).given : regionalName(originStateId, sex, key).given;
    name = originStateId === "estran" ? regionalName("estran", sex, key, surname).full : `${given} ${surname}`;
    if (!taken.has(given)) { taken.add(given); break; }
  }
  return { id, name, sex, age, look, origin: originStateId };
}

function npc(spec: PersonSpec, homeId: string, extra: Partial<NpcDef>, clothing: string): NpcDef {
  return {
    id: spec.id, name: spec.name, homeId, age: spec.age, birthYear: CURRENT_YEAR - spec.age, lifeStatus: "alive", roleTags: ["commoner"], goals: ["содержать дом и близких"],
    originStateId: spec.origin, schedule: [],
    appearance: createAppearanceState({ skinTone: spec.look.skinTone, naturalHairColor: spec.look.hairColor, hairTexture: spec.look.hairTexture, eyeColor: spec.look.eyeColor, facialFeatures: spec.look.facialFeatures },
      { hairstyle: spec.sex === "male" ? "коротко подстриженные волосы" : "волосы убраны под платок", clothing }),
    ...extra
  };
}

export function generateNewbornHousehold(draft: VeloriaCharacterDraft, familyId: string, seedText: string): NewbornHousehold | { error: string } {
  if (!NEWBORN_ORIGINS.includes(draft.originId)) return { error: "С рождения можно начать только в обычной семье: арендаторы, земледельцы, ремесленники, торговцы, возчики или подкидыш у храма." };
  const seed = seedText;
  const kind = pickKind(draft.originId, seed);
  const wealth = pickWealth(draft.originId, seed);
  const homeId = homeFor(draft.originId);
  const work = workFor(draft.originId);
  const clothing = wealth === "бедно" ? "заношенная, много раз чиненная одежда" : wealth === "скромно" ? "простая чистая одежда" : "добротная одежда из хорошей шерсти";
  const surname = regionalName("estran", "male", `${seed}:family`).surname;
  const members: NpcDef[] = [];
  const guardians: NpcDef[] = [];
  const taken = new Set<string>();
  const biologicalParents: ParentHeritage[] = [];
  const homeActivity = "ведёт хозяйство и ухаживает за младенцем";

  if (kind === "foundling") {
    const sister = person(seed, `${familyId}-sister`, "female", between(`${seed}:sister`, 28, 55), "из храма Семерых", taken);
    sister.name = `Сестра ${sister.name.split(" ")[0]}`;
    const nurse = person(seed, `${familyId}-wet-nurse`, "female", between(`${seed}:nurse`, 19, 34), regionalName("estran", "male", `${seed}:nurse-family`).surname, taken);
    const sisterNpc = npc(sister, "temple", { familyRole: "guardian", caregiving: { role: "guardian", canFeed: false }, personality: familyPersonality(`${seed}:sister`, "храмовая сестра"),
      roleTags: ["clergy"], schedule: [{ from: 0, to: 24, locationId: "temple", activity: "служит в приюте и присматривает за младенцами" }] }, "серое платье храмовой сестры");
    const nurseNpc = npc(nurse, "old-quarter", { familyRole: "other", caregiving: { role: "wet-nurse", canFeed: true }, personality: familyPersonality(`${seed}:nurse`, "кормилица"),
      schedule: [{ from: 6, to: 9, locationId: "temple", activity: "кормит младенцев приюта" }, { from: 12, to: 14, locationId: "temple", activity: "кормит младенцев приюта" }, { from: 18, to: 21, locationId: "temple", activity: "кормит младенцев приюта" }] }, "простое платье и фартук");
    members.push(sisterNpc, nurseNpc); guardians.push(sisterNpc);
    return {
      kind, wealth, homeId: "temple", members, guardians, biologicalParents,
      summary: `${capitalize(HOUSEHOLD_LABELS[kind])}. Родители неизвестны. Кормит вас ${nurse.name}, приходящая кормилица.`,
      record: {
        characterId: `player:${familyId}`, birthYear: CURRENT_YEAR, biologicalParentIds: [], biologicalParentage: "unknown", legalParentIds: [], legalParentage: "unknown",
        guardianIds: [sisterNpc.id, "institution:sevenfold-temple"], birthStatus: "unknown", parentalUnion: { status: "unknown" }, recognitions: [],
        succession: { status: "undetermined", basis: "Происхождение подкидыша неизвестно." }
      }
    };
  }

  const motherAge = between(`${seed}:mother-age`, 17, 38);
  const mother = person(seed, `${familyId}-parent-b`, "female", motherAge, surname, taken);
  const father = person(seed, `${familyId}-parent-a`, "male", Math.min(60, motherAge + between(`${seed}:gap`, 0, 9)), surname, taken);
  const fatherKnown = kind !== "unmarried-mother";
  const motherAlive = kind !== "mother-died";
  const fatherAlive = kind !== "widowed-mother" && fatherKnown;

  const motherNpc = npc(mother, homeId, {
    familyRole: "biological-parent", lifeStatus: motherAlive ? "alive" : "dead",
    caregiving: motherAlive ? { role: "mother", canFeed: true } : undefined, personality: familyPersonality(`${seed}:mother`, "мать"),
    schedule: motherAlive ? [{ from: 0, to: 24, locationId: homeId, activity: homeActivity }] : []
  }, clothing);
  members.push(motherNpc);
  biologicalParents.push({ id: mother.id, name: mother.name, appearance: mother.look });

  if (fatherKnown) {
    const fatherNpc = npc(father, homeId, {
      familyRole: "biological-parent", lifeStatus: fatherAlive ? "alive" : "dead",
      caregiving: fatherAlive ? { role: "father", canFeed: false } : undefined, personality: familyPersonality(`${seed}:father`, "отец"),
      schedule: fatherAlive ? [{ from: 6, to: 18, locationId: work.locationId, activity: work.activity }, { from: 18, to: 24, locationId: homeId, activity: "дома с семьёй" }, { from: 0, to: 6, locationId: homeId, activity: "спит дома" }] : []
    }, clothing);
    members.push(fatherNpc);
    biologicalParents.push({ id: father.id, name: father.name, appearance: father.look });
  }

  if (kind === "with-grandmother" || kind === "mother-died") {
    const gran = person(seed, `${familyId}-grandmother`, "female", Math.min(75, motherAge + between(`${seed}:gran`, 20, 28)), surname, taken);
    const granNpc = npc(gran, homeId, { familyRole: "other", caregiving: { role: "relative", canFeed: false }, personality: familyPersonality(`${seed}:gran`, "бабушка"),
      schedule: [{ from: 0, to: 24, locationId: homeId, activity: "нянчит внуков и ведёт хозяйство" }] }, clothing);
    members.push(granNpc); guardians.push(granNpc);
  }
  if (kind === "mother-died") {
    const nurse = person(seed, `${familyId}-wet-nurse`, "female", between(`${seed}:nurse`, 19, 34), regionalName("estran", "male", `${seed}:nurse-family`).surname, taken);
    const nurseNpc = npc(nurse, "old-quarter", { familyRole: "other", caregiving: { role: "wet-nurse", canFeed: true }, personality: familyPersonality(`${seed}:nurse`, "кормилица"),
      schedule: [{ from: 6, to: 9, locationId: homeId, activity: "кормит младенца" }, { from: 12, to: 14, locationId: homeId, activity: "кормит младенца" }, { from: 18, to: 22, locationId: homeId, activity: "кормит младенца" }] }, "простое платье и фартук");
    members.push(nurseNpc);
  }

  // Старшие братья и сёстры: родились минимум через два года друг от друга, после 17 лет матери.
  const maxSiblings = kind === "large-family" ? 5 : kind === "unmarried-mother" || kind === "widowed-mother" ? 1 : 2;
  const minSiblings = kind === "large-family" ? 3 : 0;
  const wanted = between(`${seed}:siblings`, minSiblings, maxSiblings);
  const siblings: string[] = [];
  let age = between(`${seed}:sib-gap`, 2, 3);
  for (let i = 0; i < wanted && motherAge - age >= 17; i++) {
    const sex = unit(`${seed}:sib-sex:${i}`) < 0.5 ? "male" as const : "female" as const;
    const sib = person(seed, `${familyId}-sibling-${i + 1}`, sex, age, surname, taken);
    // Брат или сестра наследует признаки от тех же родителей.
    sib.look = fatherKnown ? childOf(mother.look, father.look, `${seed}:sib-look:${i}`) : childOf(mother.look, mother.look, `${seed}:sib-look:${i}`);
    const helps = age >= 10;
    members.push(npc(sib, homeId, {
      familyRole: "other", personality: familyPersonality(`${seed}:sib:${i}`, sex === "male" ? "старший брат" : "старшая сестра"),
      caregiving: age >= 8 ? { role: "relative", canFeed: false } : undefined,
      schedule: helps ? [{ from: 7, to: 15, locationId: work.locationId, activity: "помогает взрослым с работой" }, { from: 15, to: 24, locationId: homeId, activity: "дома" }, { from: 0, to: 7, locationId: homeId, activity: "спит" }]
        : [{ from: 0, to: 24, locationId: homeId, activity: "играет дома и во дворе" }]
    }, clothing));
    siblings.push(`${sib.name.split(" ")[0]} (${age} ${age < 5 ? "года" : "лет"})`);
    age += between(`${seed}:sib-gap:${i}`, 2, 4);
  }

  const appearance = fatherKnown ? childOf(mother.look, father.look, `${seed}:child`) : childOf(mother.look, mother.look, `${seed}:child`);
  const foreignNote = [mother, ...(fatherKnown ? [father] : [])].filter(p => p.origin !== "estran").map(p => `${p.name.split(" ")[0]} родом не из Эстрана.`).join(" ");
  const parentsText = fatherKnown ? `Родители: ${mother.name} (${mother.age}) и ${father.name} (${father.age}).` : `Мать: ${mother.name} (${mother.age}).`;
  const summary = `${capitalize(HOUSEHOLD_LABELS[kind])}. ${parentsText} Живёте ${wealth}. ${siblings.length ? `Старшие: ${siblings.join(", ")}.` : "Вы первый ребёнок в семье."} ${foreignNote}`.trim();

  const parentIds = biologicalParents.map(p => p.id);
  return {
    kind, wealth, homeId, members, guardians, biologicalParents, appearance, summary,
    record: {
      characterId: `player:${familyId}`, birthYear: CURRENT_YEAR,
      biologicalParentIds: parentIds, biologicalParentage: parentIds.length === 2 ? "both-known" : "one-known",
      legalParentIds: kind === "unmarried-mother" ? [mother.id] : parentIds, legalParentage: kind === "unmarried-mother" || parentIds.length === 1 ? "one-known" : "both-known",
      guardianIds: guardians.map(g => g.id), birthStatus: kind === "unmarried-mother" ? "unrecognized" : "legitimate",
      parentalUnion: { status: kind === "unmarried-mother" ? "unmarried" : "married" }, recognitions: [],
      succession: { status: "undetermined", basis: "Простолюдинская семья: наследство: дом и ремесло по обычаю Ровена." }
    }
  };
}
