import { createAppearanceState } from "../../engine/appearance";
import type { NpcDef, WorldData } from "../../engine/types";
import type { VeloriaCharacterDraft } from "./character";
import type { CharacterFamilyRecord } from "./family";
import { VELORIA_CANON } from "./lore";
import { regionalName, sampleResidentAppearance, type StateId } from "./populations";
import { generateNewbornHousehold, type HouseholdKind, type Wealth } from "./birthFamily";
import {
  getChildAppearanceOptions,
  type AppearanceProfile,
  type ParentHeritage,
  type SkinTone
} from "./heritage";

const CURRENT_YEAR = VELORIA_CANON.calendar.currentYearKL;
const MASCULINE_NAMES = ["Эдрен", "Тален", "Остен", "Йорен", "Леван", "Ренар", "Дамир", "Орест"];
const FEMININE_NAMES = ["Ива", "Нера", "Сера", "Мира", "Лина", "Эна", "Вейра", "Адела"];
const SURNAMES = ["Норрен", "Сорел", "Элвин", "Вейл", "Келлер", "Мерр", "Тален", "Ровен"];

export interface GeneratedFamilyAssignment {
  available: boolean;
  reason?: string;
  record?: CharacterFamilyRecord;
  members: NpcDef[];
  biologicalParents: ParentHeritage[];
  guardians: NpcDef[];
  defaultAppearance?: AppearanceProfile;
  summary: string;
  /** Только для старта с рождения в обычной семье. */
  household?: { kind: HouseholdKind; wealth: Wealth; homeId: string };
}

function hash(value: string): number {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) {
    result ^= value.charCodeAt(i);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function pick<T>(values: readonly T[], seed: number): T {
  return values[seed % values.length]!;
}

function homeForOrigin(originId: VeloriaCharacterDraft["originId"]): string {
  if (originId === "tenant-farmer" || originId === "free-farmer") return "mill-road";
  if (originId === "craft-apprentice" || originId === "independent-craftsman") return "old-quarter";
  if (originId === "merchant-child" || originId === "small-trader") return "lower-market";
  if (originId === "former-soldier" || originId === "caravan-hand") return "river-dock";
  if (originId === "temple-novice") return "temple";
  return "old-quarter";
}

function workForOrigin(originId: VeloriaCharacterDraft["originId"], second: boolean): { locationId: string; activity: string } {
  if (originId === "tenant-farmer" || originId === "free-farmer") return { locationId: "mill-road", activity: "занимается хозяйством и полями" };
  if (originId === "craft-apprentice" || originId === "independent-craftsman") return { locationId: second ? "lower-market" : "smithy", activity: second ? "покупает припасы для мастерской" : "работает в мастерской" };
  if (originId === "merchant-child" || originId === "small-trader") return { locationId: second ? "guild-house" : "lower-market", activity: second ? "ведёт торговые записи" : "торгует на рынке" };
  if (originId === "former-soldier" || originId === "caravan-hand") return { locationId: second ? "grey-fox" : "river-dock", activity: second ? "встречается с возчиками" : "работает с обозами" };
  return { locationId: second ? "grey-fox" : "lower-market", activity: second ? "занимается домашними делами" : "работает на подённой работе" };
}

/**
 * Родитель: житель Ровена: внешность берётся из населения Эстрана, изредка родитель
 * оказывается приезжим (Ровен: торговый город на реке). См. populations.ts.
 */
export function parentHeritage(id: string, name: string, seed: number): ParentHeritage & { originStateId: StateId } {
  const { originStateId, ...appearance } = sampleResidentAppearance("estran", `parent:${seed}`, "city");
  return { id, name, appearance, originStateId };
}

function npcFromParent(
  id: string, name: string, heritage: ParentHeritage, age: number, familyRole: "biological-parent" | "guardian",
  homeId: string, lifeStatus: "alive" | "missing", work?: { locationId: string; activity: string }, second = false
): NpcDef {
  const appearance = createAppearanceState({
    skinTone: heritage.appearance.skinTone,
    naturalHairColor: heritage.appearance.hairColor,
    hairTexture: heritage.appearance.hairTexture,
    eyeColor: heritage.appearance.eyeColor,
    facialFeatures: heritage.appearance.facialFeatures
  }, {
    hairstyle: second ? "волосы собраны и убраны от лица" : "простая короткая причёска",
    clothing: "обычная одежда жителя Ровена"
  });
  return {
    id, name, homeId, age, birthYear: CURRENT_YEAR - age, lifeStatus, familyRole,
    roleTags: ["commoner"],
    goals: ["содержать дом и близких", "сохранять устойчивый заработок"],
    schedule: lifeStatus === "alive" && work
      ? [{ from: 7, to: 17, locationId: work.locationId, activity: work.activity }]
      : [],
    appearance
  };
}

function defaultChildAppearance(a: ParentHeritage, b: ParentHeritage): AppearanceProfile | undefined {
  const options = getChildAppearanceOptions(a, b);
  if (!options.parentsKnown) return undefined;
  const skinTone = Math.max(options.skinMin, Math.min(options.skinMax, Math.round((a.appearance.skinTone + b.appearance.skinTone) / 2))) as SkinTone;
  return {
    skinTone,
    hairColor: a.appearance.hairColor,
    hairTexture: b.appearance.hairTexture,
    eyeColor: a.appearance.eyeColor,
    facialFeatures: a.appearance.facialFeatures === b.appearance.facialFeatures ? a.appearance.facialFeatures : "mixed"
  };
}

export function generateVeloriaFamily(draft: VeloriaCharacterDraft, existingNpcIds: readonly string[] = []): GeneratedFamilyAssignment {
  if (draft.dynasticRole === "second-prince") {
    const father: ParentHeritage = {
      id: "rey-consort", name: "Гарен Вальд",
      appearance: { skinTone: 2, hairColor: "light-blond", hairTexture: "wavy", eyeColor: "grey", facialFeatures: "angular" },
      familyVariants: { skinToneRange: [1, 3], hairColors: ["light-blond", "blond", "brown"], eyeColors: ["blue", "grey", "hazel", "brown"], facialFeatures: ["angular", "soft", "narrow"] }
    };
    const mother: ParentHeritage = {
      id: "rey-second-prince-mother", name: "Имя матери не установлено",
      appearance: { skinTone: 5, hairColor: "black", hairTexture: "straight", eyeColor: "dark-brown", facialFeatures: "east-asian" },
      familyVariants: { skinToneRange: [4, 6], hairColors: ["black", "dark-brown"], eyeColors: ["dark-brown", "brown"], facialFeatures: ["east-asian", "narrow", "soft"] }
    };
    const fixedAppearance: AppearanceProfile = { skinTone: 3, hairColor: "light-blond", hairTexture: "straight", eyeColor: "dark-brown", facialFeatures: "east-asian", notes: ["Каноническая внешность второго принца; не редактируется в анкете."] };
    const nurse: NpcDef = {
      id: "rey-second-prince-nurse", name: "Мейра, королевская кормилица", homeId: "rey:royal-nursery", age: 43, birthYear: 680, lifeStatus: "alive", familyRole: "guardian", roleTags: ["commoner"],
      goals: ["обеспечивать уход за младенцем", "не допускать конфликтов взрослых рядом с ребёнком"],
      personality: { temperament: "спокойная, практичная и решительная в вопросах безопасности младенца", traits: { warmth: 84, sociability: 42, assertiveness: 68, emotionalReactivity: 26, patience: 93, openness: 48, discipline: 91, suspicion: 58, empathy: 90, pride: 43 }, values: ["здоровье ребёнка", "порядок", "бережный уход"], formativeExperiences: ["Много лет служит при королевском доме и умеет сохранять спокойствие в напряжённой обстановке."], copingPatterns: ["пресекает ссоры рядом с младенцем", "сначала проверяет потребности ребёнка"], initialHabits: [{ id: "nurse-routine", label: "проверяет кормление, сон и тепло младенца по порядку", trigger: "каждый уход", strength: 95 }] },
      schedule: [{ from: 0, to: 24, locationId: "rey:royal-nursery", activity: "ухаживает за младенцем" }]
    };
    const record: CharacterFamilyRecord = {
      characterId: "player:rey-second-prince", birthYear: 723,
      biologicalParentIds: [father.id, mother.id], biologicalParentage: "both-known",
      legalParentIds: [father.id], legalParentage: "one-known", guardianIds: [nurse.id],
      birthStatus: "acknowledged", parentalUnion: { status: "unmarried", startYear: 723 },
      recognitions: [{ parentId: father.id, recognized: true, basis: "record", year: 723 }],
      succession: { status: "eligible", houseId: "reynar", basis: "Отцовство Гарена Вальда признано; королевская грамота ставит второго принца после кронпринца. Положение может быть оспорено в Королевском суде." }
    };
    return {
      available: true, record, members: [], guardians: [nurse], biologicalParents: [father, mother], defaultAppearance: fixedAppearance,
      summary: "Биологические родители: Гарен Вальд и женщина из далёкой восточной земли. Родители не состояли в браке; Гарен признал сына. Элиана (в 723 КЛ: принцесса, королевой станет в 735 КЛ) не является твоей матерью: она жена Гарена и испытывает к тебе личную неприязнь из-за его измены. Королевская кормилица Мейра назначена опекуном на время младенчества."
    };
  }
  if (draft.age === 0) {
    const seed = hash(draft.familySeed ?? draft.name.trim().toLocaleLowerCase("ru-RU"));
    const occupied = new Set(existingNpcIds);
    let familyId = `roven-family-${seed.toString(36)}`;
    for (let i = 1; occupied.has(`${familyId}-parent-a`) || occupied.has(`${familyId}-parent-b`) || occupied.has(`${familyId}-sister`); i++) familyId = `roven-family-${seed.toString(36)}-${i}`;
    const household = generateNewbornHousehold(draft, familyId, `${seed}`);
    if ("error" in household) return { available: false, reason: household.error, members: [], biologicalParents: [], guardians: [], summary: household.error };
    return {
      available: true, record: household.record, members: household.members, biologicalParents: household.biologicalParents, guardians: household.guardians,
      defaultAppearance: household.appearance, summary: household.summary, household: { kind: household.kind, wealth: household.wealth, homeId: household.homeId }
    };
  }
  const unsupportedNobleOrigins: VeloriaCharacterDraft["originId"][] = ["minor-heir", "noble-younger", "acknowledged-bastard", "impoverished-noble"];
  if (unsupportedNobleOrigins.includes(draft.originId)) {
    return {
      available: false,
      reason: draft.originId === "acknowledged-bastard"
        ? "В текущем каноне нет конкретной подтверждённой пары биологических родителей и записи о признании для нового бастарда. Этот сценарий пока закрыт, чтобы не выдумывать родословную."
        : "Для дворянского сценария пока нельзя назначить нового персонажа существующему дому без согласования родословной, дат и наследственного права. Этот сценарий временно закрыт.",
      members: [], biologicalParents: [], guardians: [],
      summary: "Семья не назначена: сценарий требует канонической родословной."
    };
  }
  if (draft.originId === "temple-orphan" && !["unknown", "chosen-family"].includes(draft.familyState)) {
    return {
      available: false, reason: "Для воспитанника храмового приюта биологическая семья не может одновременно считаться живущей рядом. Выбери неизвестное происхождение или приёмную/выбранную семью.",
      members: [], biologicalParents: [], guardians: [], summary: "Сценарий семьи противоречит происхождению воспитанника приюта."
    };
  }

  // Seed фиксируется один раз в черновике; имя и выбранная социальная роль не меняют родословную.
  const seed = hash(draft.familySeed ?? draft.name.trim().toLocaleLowerCase("ru-RU"));
  const baseFamilyId = `roven-family-${seed.toString(36)}`;
  const occupied = new Set(existingNpcIds);
  let familyId = baseFamilyId;
  let collisionIndex = 1;
  while (occupied.has(`${familyId}-parent-a`) || occupied.has(`${familyId}-parent-b`)) {
    familyId = `${baseFamilyId}-${collisionIndex++}`;
  }
  const surname = pick(SURNAMES, seed >>> 2);
  const firstNames = [pick(MASCULINE_NAMES, seed >>> 5), pick(FEMININE_NAMES, seed >>> 8)];
  const parentNames = firstNames.map(first => `${first} ${surname}`);
  const homeId = draft.familyState === "distant" || draft.familyState === "lost" ? "mill-road" : homeForOrigin(draft.originId);
  const isBiologicalFamily = ["together", "distant", "lost"].includes(draft.familyState);
  const isChosenFamily = draft.familyState === "chosen-family";
  const members: NpcDef[] = [];
  const biologicalParents: ParentHeritage[] = [];
  const guardians: NpcDef[] = [];
  const ids = [`${familyId}-parent-a`, `${familyId}-parent-b`];

  if (isBiologicalFamily || isChosenFamily) {
    for (let index = 0; index < 2; index++) {
      const id = ids[index]!;
      const heritage = parentHeritage(id, parentNames[index]!, seed + index * 7919);
      // Приезжий родитель носит имя своей земли; фамилия семьи общая.
      if (heritage.originStateId !== "estran") {
        parentNames[index] = `${regionalName(heritage.originStateId, index === 0 ? "male" : "female", `parent:${seed}:${index}`).given} ${surname}`;
        heritage.name = parentNames[index]!;
      }
      const name = parentNames[index]!;
      const parentAgeAtBirth = Math.min(38, Math.max(17, 88 - draft.age)) + index * 2;
      const age = draft.age + parentAgeAtBirth;
      const lifeStatus = draft.familyState === "lost" ? "missing" : "alive";
      const work = draft.familyState === "together" ? workForOrigin(draft.originId, index === 1) : undefined;
      const npc = npcFromParent(id, name, heritage, age, isChosenFamily ? "guardian" : "biological-parent", homeId, lifeStatus, work, index === 1);
      members.push(npc);
      if (isChosenFamily) guardians.push(npc);
      else biologicalParents.push(heritage);
    }
  }

  const biologicalParentIds = biologicalParents.map(parent => parent.id);
  const guardianIds = guardians.map(guardian => guardian.id);
  if (draft.originId === "temple-orphan" && draft.familyState === "unknown") guardianIds.push("institution:sevenfold-temple");
  const record: CharacterFamilyRecord = {
    characterId: `player:${familyId}`,
    birthYear: CURRENT_YEAR - draft.age,
    biologicalParentIds,
    biologicalParentage: biologicalParentIds.length === 2 ? "both-known" : biologicalParentIds.length === 1 ? "one-known" : "unknown",
    legalParentIds: [],
    legalParentage: "unknown",
    guardianIds,
    birthStatus: "unknown",
    parentalUnion: { status: isBiologicalFamily ? draft.parentalUnionStatus ?? "unknown" : "unknown" },
    recognitions: [],
    succession: { status: "undetermined", basis: "Сословное или наследственное право не установлено этой семейной записью." }
  };

  const unionSummary = draft.parentalUnionStatus === "married"
    ? "Родители указаны как состоявшие в браке; юридическое родительство и признание всё равно проверяются отдельно."
    : draft.parentalUnionStatus === "unmarried"
      ? "Родители указаны как не состоявшие в браке; это само по себе не определяет юридическое признание или наследование."
      : "Брачный статус родителей не установлен; юридическое родительство и признание также остаются неизвестными.";
  const summary = isBiologicalFamily
    ? `Биологические родители: ${parentNames.join(" и ")}. ${draft.familyState === "lost" ? "Оба родителя числятся пропавшими; смерть не подтверждена." : draft.familyState === "distant" ? "Родители живут в окрестностях, отдельно от героя." : "Родители живут в Ровене или рядом."} ${unionSummary}`
    : isChosenFamily
      ? `Опекуны: ${parentNames.join(" и ")}. Биологическое происхождение остаётся неизвестным; опека сама по себе не доказывает усыновление.`
      : guardianIds.length
        ? "Биологические родители неизвестны. Храм Семерых указан как учреждение-опекун; конкретный воспитатель не назначен."
        : "Биологические родители, юридические родители и опекуны пока неизвестны.";

  return {
    available: true,
    record,
    members,
    biologicalParents,
    guardians,
    defaultAppearance: biologicalParents.length === 2 ? defaultChildAppearance(biologicalParents[0]!, biologicalParents[1]!) : undefined,
    summary
  };
}

export function attachGeneratedFamily(world: WorldData, assignment: GeneratedFamilyAssignment): WorldData {
  if (!assignment.available || assignment.members.length === 0) return world;
  if (assignment.members.some(member => world.npcs[member.id])) throw new Error("Сгенерированная семья столкнулась с уже существующими ID NPC.");
  return {
    ...world,
    npcs: { ...world.npcs, ...Object.fromEntries(assignment.members.map(member => [member.id, member])) }
  };
}
