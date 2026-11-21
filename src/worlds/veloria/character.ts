import type { WorldData } from "../../engine/types";
import { createVeloriaWorld } from "./world";
import { attachStartEntourage } from "./upperSociety";
import { NEWBORN_ORIGINS, NEWBORN_ORIGIN_LABELS } from "./birthFamily";
import { generateVeloriaFamily } from "./familyGeneration";
import { buildReynarCourt, SECOND_PRINCE_START_YEAR } from "./reynarCourt";
import { VELORIA_ORIGIN_LABELS } from "./lore";
import { FAITHS } from "./faiths";
import type { EyeColor, FacialFeatureSet, HairColor, HairTexture, SkinTone } from "./heritage";

export type VeloriaOriginId = keyof typeof VELORIA_ORIGIN_LABELS;
export type VeloriaStatusId = "noble" | "guild-free" | "rural-free" | "temple" | "marginal" | "serving";
export type VeloriaProfessionId =
  | "squire" | "scribe" | "guard" | "soldier" | "merchant" | "craftsman"
  | "apprentice" | "farmer" | "healer-assistant" | "carter" | "laborer" | "none";
export type VeloriaFamilyState = "together" | "distant" | "lost" | "unknown" | "chosen-family";
export type VeloriaStartScenario = "ordinary" | "journey" | "debt-flight" | "exile" | "captivity-escape";

export interface VeloriaCharacterDraft {
  /** Специальная каноническая роль; не генерируется случайно. */
  dynasticRole?: "second-prince";
  name: string; age: number; originId: VeloriaOriginId; statusId: VeloriaStatusId;
  professionId: VeloriaProfessionId; familyState: VeloriaFamilyState;
  startScenarioId: VeloriaStartScenario; biography: string;
  attributes: Record<string, number>;
  /** Дополнительные личные сведения; необязательны для старых сохранений и тестовых анкет. */
  heightCm?: number; weightKg?: number; build?: string; hair?: string; hairstyle?: string; eyes?: string; appearance?: string;
  /** Наследуемые признаки доступны только после назначения двух биологических родителей. */
  skinTone?: SkinTone; hairColor?: HairColor; hairTexture?: HairTexture; eyeColor?: EyeColor; facialFeatures?: FacialFeatureSet;
  parentalUnionStatus?: "married" | "unmarried" | "unknown";
  /** Внутренний seed одной анкеты: не меняется при правке имени/возраста/семейного статуса. */
  familySeed?: string;
  personality?: string; education?: string; faithId?: string; skills?: string; familyNotes?: string;
  /** Для старта с рождения: врождённый темперамент и ожидаемое телосложение (не готовый характер). */
  sex?: "male" | "female" | "unspecified";
  temperament?: Partial<import("../../engine/development").Temperament>;
  bodyBuild?: import("../../engine/development").BodyBuild;
  heightTendency?: import("../../engine/development").HeightTendency;
}
export const VELORIA_START_SETTLEMENT_ID = "roven" as const;

export interface VeloriaStart {
  /** Обычная кампания всегда начинается в городе Ровен. */
  settlementId: string;
  locationId: string; money: number; inventory: Record<string, number>; notes: string[];
}
export type CharacterValidation =
  | { ok: true; start: VeloriaStart }
  | { ok: false; errors: string[] };

const ORIGIN_STATUS: Record<VeloriaOriginId, VeloriaStatusId[]> = {
  "minor-heir": ["noble"], "noble-younger": ["noble"],
  "acknowledged-bastard": ["noble", "marginal"], "impoverished-noble": ["noble", "marginal"],
  "craft-apprentice": ["guild-free", "serving"], "independent-craftsman": ["guild-free"],
  "merchant-child": ["guild-free", "serving"], "small-trader": ["guild-free"],
  "tenant-farmer": ["rural-free", "serving"], "free-farmer": ["rural-free"],
  "temple-orphan": ["temple", "marginal"], "temple-novice": ["temple"],
  "former-soldier": ["serving", "marginal"], "caravan-hand": ["serving", "marginal"],
  "debt-runaway": ["marginal"], "wanderer": ["marginal", "serving"]
};
const STATUS_PROFESSIONS: Record<VeloriaStatusId, VeloriaProfessionId[]> = {
  noble: ["squire", "scribe", "guard", "none"],
  "guild-free": ["craftsman", "merchant", "scribe", "apprentice", "none"],
  "rural-free": ["farmer", "laborer", "carter", "none"],
  temple: ["healer-assistant", "scribe", "laborer", "none"],
  marginal: ["laborer", "carter", "guard", "none"],
  serving: ["soldier", "guard", "carter", "laborer", "apprentice", "none"]
};
const PROFESSION_ORIGINS: Record<VeloriaProfessionId, VeloriaOriginId[]> = {
  squire: ["minor-heir", "noble-younger", "impoverished-noble"],
  scribe: ["minor-heir", "noble-younger", "acknowledged-bastard", "merchant-child", "independent-craftsman", "temple-novice", "temple-orphan"],
  guard: ["minor-heir", "noble-younger", "former-soldier", "wanderer", "debt-runaway"],
  soldier: ["former-soldier", "caravan-hand", "wanderer"],
  merchant: ["merchant-child", "small-trader"],
  craftsman: ["independent-craftsman"],
  apprentice: ["craft-apprentice", "merchant-child", "wanderer"],
  farmer: ["tenant-farmer", "free-farmer"],
  "healer-assistant": ["temple-novice", "temple-orphan"],
  carter: ["caravan-hand", "tenant-farmer", "debt-runaway", "wanderer"],
  laborer: ["tenant-farmer", "temple-orphan", "former-soldier", "caravan-hand", "debt-runaway", "wanderer"],
  none: Object.keys(ORIGIN_STATUS) as VeloriaOriginId[]
};
const BASE_START: Record<VeloriaOriginId, Omit<VeloriaStart, "settlementId">> = {
  "minor-heir": { locationId: "upper-street", money: 35, inventory: { plain_clothes: 1, wool_cloak: 1 }, notes: ["Есть родовой дом и обязанности перед семьёй."] },
  "noble-younger": { locationId: "upper-street", money: 22, inventory: { plain_clothes: 1, wool_cloak: 1 }, notes: ["Положение зависит от старшего наследника."] },
  "acknowledged-bastard": { locationId: "upper-street", money: 14, inventory: { plain_clothes: 1 }, notes: ["Признание происхождения не даёт автоматического права наследования."] },
  "impoverished-noble": { locationId: "grey-fox", money: 9, inventory: { plain_clothes: 1 }, notes: ["Имущество семьи почти утрачено."] },
  "craft-apprentice": { locationId: "smithy", money: 4, inventory: { plain_clothes: 1, hammer: 1 }, notes: ["Мастер вправе требовать работу по ученическому договору."] },
  "independent-craftsman": { locationId: "lower-market", money: 18, inventory: { plain_clothes: 1, hammer: 1 }, notes: ["Есть ремесло, но нет гарантии заказов."] },
  "merchant-child": { locationId: "guild-house", money: 16, inventory: { plain_clothes: 1 }, notes: ["Семья связана с торговлей и обязательствами."] },
  "small-trader": { locationId: "lower-market", money: 24, inventory: { plain_clothes: 1 }, notes: ["Есть небольшой оборотный капитал."] },
  "tenant-farmer": { locationId: "grey-fox", money: 3, inventory: { plain_clothes: 1, bread: 1 }, notes: ["Персонаж находится в Ровене по делу семьи или для торговли на рынке; хозяйство остаётся за городом.", "Семья платит аренду и отдаёт часть урожая."] },
  "free-farmer": { locationId: "grey-fox", money: 8, inventory: { plain_clothes: 1, bread: 2 }, notes: ["Персонаж прибыл в Ровен с товаром или по семейному делу; само хозяйство находится за пределами города.", "Хозяйство зависит от погоды и рынка."] },
  "temple-orphan": { locationId: "temple", money: 1, inventory: { plain_clothes: 1, bread: 1 }, notes: ["Храм дал кров и обучение, но не гарантирует пожизненное содержание."] },
  "temple-novice": { locationId: "temple", money: 2, inventory: { plain_clothes: 1 }, notes: ["Есть обязанности перед храмом и наставником."] },
  "former-soldier": { locationId: "south-gate", money: 7, inventory: { plain_clothes: 1, knife: 1 }, notes: ["Служебные связи могут помочь, но прошлое может настичь."] },
  "caravan-hand": { locationId: "river-dock", money: 5, inventory: { plain_clothes: 1, rope: 1 }, notes: ["Знает дорожную работу, но не знает автоматически судьбу пропавших обозов."] },
  "debt-runaway": { locationId: "old-quarter", money: 1, inventory: { plain_clothes: 1 }, notes: ["Кредитор может искать персонажа; стража не знает этого автоматически."] },
  "wanderer": { locationId: "south-gate", money: 2, inventory: { plain_clothes: 1, bread: 1 }, notes: ["Нет подтверждённого статуса и устойчивых связей."] }
};
const SCENARIOS: Record<VeloriaStartScenario, VeloriaOriginId[]> = {
  ordinary: Object.keys(BASE_START) as VeloriaOriginId[],
  journey: ["minor-heir", "noble-younger", "acknowledged-bastard", "impoverished-noble", "small-trader", "former-soldier", "caravan-hand", "wanderer"],
  "debt-flight": ["small-trader", "tenant-farmer", "former-soldier", "caravan-hand", "debt-runaway", "wanderer"],
  exile: ["minor-heir", "noble-younger", "acknowledged-bastard", "impoverished-noble", "former-soldier", "wanderer"],
  "captivity-escape": ["former-soldier", "caravan-hand", "debt-runaway", "wanderer"]
};
const ATTRIBUTES = ["Сила", "Выносливость", "Ловкость", "Интеллект", "Восприятие", "Харизма", "Воля"] as const;

export function availableStatuses(origin: VeloriaOriginId): VeloriaStatusId[] {
  return [...(ORIGIN_STATUS[origin] ?? [])];
}
export function availableProfessions(origin: VeloriaOriginId, status: VeloriaStatusId): VeloriaProfessionId[] {
  if (!ORIGIN_STATUS[origin]?.includes(status)) return [];
  return STATUS_PROFESSIONS[status].filter(p => PROFESSION_ORIGINS[p].includes(origin));
}
export function availableScenarios(origin: VeloriaOriginId): VeloriaStartScenario[] {
  return (Object.keys(SCENARIOS) as VeloriaStartScenario[]).filter(s => SCENARIOS[s].includes(origin));
}

export function resolveVeloriaStart(draft: VeloriaCharacterDraft): CharacterValidation {
  const errors: string[] = [];
  if (!draft.name.trim() || draft.name.trim().length > 40) errors.push("Имя: от 1 до 40 символов.");
  if (!Number.isInteger(draft.age) || draft.age < 0 || draft.age > 80) errors.push("Возраст: от 0 до 80 лет.");
  if (draft.age < 16 && draft.professionId !== "none") errors.push("Ребёнок младше 16 лет не может иметь полноценную взрослую профессию.");
  if (draft.dynasticRole === "second-prince") {
    if (draft.originId !== "acknowledged-bastard" || draft.statusId !== "noble" || draft.professionId !== "none" || draft.familyState !== "together" || draft.age !== 0 || draft.startScenarioId !== "ordinary" || draft.parentalUnionStatus !== "unmarried") errors.push("Сценарий второго принца начинается при рождении в 723 КЛ: дворянский статус, признанный сын, мать жива при рождении, родители не состояли в браке.");
  } else if (!ORIGIN_STATUS[draft.originId]?.includes(draft.statusId)) errors.push("Статус несовместим с происхождением.");
  if (draft.dynasticRole !== "second-prince" && (!STATUS_PROFESSIONS[draft.statusId]?.includes(draft.professionId) ||
      !PROFESSION_ORIGINS[draft.professionId]?.includes(draft.originId))) errors.push("Профессия несовместима с происхождением или статусом.");
  if (draft.dynasticRole !== "second-prince" && !SCENARIOS[draft.startScenarioId]?.includes(draft.originId)) errors.push("Стартовая ситуация несовместима с биографией.");
  if (draft.age === 0 && draft.dynasticRole !== "second-prince") {
    if (!NEWBORN_ORIGINS.includes(draft.originId)) errors.push("С рождения можно начать только в обычной семье: арендаторы, земледельцы, ремесленники, торговцы, возчики или подкидыш у храма.");
    if (draft.startScenarioId !== "ordinary") errors.push("Старт с рождения возможен только в обычной ситуации.");
  }
  if (draft.biography.length > 2000) errors.push("Биография: максимум 2000 символов.");
  if (draft.heightCm !== undefined && (!Number.isInteger(draft.heightCm) || draft.heightCm < (draft.age < 5 ? 40 : draft.age < 12 ? 70 : draft.age < 16 ? 110 : 140) || draft.heightCm > (draft.age < 5 ? 125 : draft.age < 12 ? 165 : draft.age < 16 ? 200 : 205))) errors.push("Рост не соответствует допустимому диапазону для выбранного возраста.");
  if (draft.weightKg !== undefined && (!Number.isFinite(draft.weightKg) || draft.weightKg < (draft.age < 5 ? 2 : draft.age < 12 ? 8 : draft.age < 16 ? 25 : 40) || draft.weightKg > (draft.age < 5 ? 30 : draft.age < 12 ? 70 : draft.age < 16 ? 110 : 140))) errors.push("Вес не соответствует допустимому диапазону для выбранного возраста.");
  if (draft.age >= 16 && draft.heightCm !== undefined && draft.weightKg !== undefined) {
    const bmi = draft.weightKg / ((draft.heightCm / 100) ** 2);
    if (bmi < 16 || bmi > 38) errors.push("Сочетание роста и веса выходит за заданный реалистичный диапазон; проверь оба значения.");
  }
  if ((draft.build?.length ?? 0) > 40) errors.push("Телосложение: максимум 40 символов.");
  if ((draft.hair?.length ?? 0) > 80 || (draft.hairstyle?.length ?? 0) > 80 || (draft.eyes?.length ?? 0) > 80) errors.push("Описание волос и глаз: максимум 80 символов для каждого поля.");
  if ((draft.appearance?.length ?? 0) > 600) errors.push("Описание внешности: максимум 600 символов.");
  if ((draft.personality?.length ?? 0) > 600) errors.push("Характер: максимум 600 символов.");
  if ((draft.education?.length ?? 0) > 300) errors.push("Образование: максимум 300 символов.");
  if ((draft.skills?.length ?? 0) > 500) errors.push("Навыки: максимум 500 символов.");
  if ((draft.familyNotes?.length ?? 0) > 500) errors.push("Сведения о семье: максимум 500 символов.");
  if (draft.faithId !== undefined && draft.faithId !== "none" && !FAITHS.some(f => f.id === draft.faithId)) errors.push("Выбрана неизвестная религиозная традиция.");
  for (const key of ATTRIBUTES) {
    const value = draft.attributes[key];
    if (!Number.isInteger(value) || value < 1 || value > 30) errors.push(`${key}: от 1 до 30.`);
  }
  if (Object.keys(draft.attributes).length !== 7 ||
      Object.values(draft.attributes).reduce((a, b) => a + b, 0) !== 100) {
    errors.push("Нужно распределить ровно 100 очков между семью характеристиками.");
  }
  if (errors.length) return { ok: false, errors };

  const base = BASE_START[draft.originId];
  const start: VeloriaStart = {
    settlementId: draft.dynasticRole === "second-prince" ? "koronholm" : VELORIA_START_SETTLEMENT_ID,
    locationId: draft.dynasticRole === "second-prince" ? "rey:royal-nursery" : base.locationId,
    money: draft.dynasticRole === "second-prince" ? 0 : base.money,
    inventory: draft.dynasticRole === "second-prince" ? { swaddling_cloth: 1 } : { ...base.inventory }, notes: draft.dynasticRole === "second-prince"
      ? ["Ты родился в 723 КЛ во дворце Коронхольма как второй сын Гарена Вальда от женщины из далёкой восточной земли. Гарен признал тебя, хотя родители не состояли в браке.", "Элиана — жена Гарена, но не твоя мать. Её личная неприязнь к тебе вызвана изменой супруга; публично она соблюдает королевский протокол. Кронпринц Альдрен остаётся первым в линии наследования.", "Кампания начинается в день твоего рождения. Характеристики анкеты отражают задатки, а не навыки новорождённого."]
      : [...base.notes]
  };
  if (draft.age === 0 && draft.dynasticRole !== "second-prince") {
    const household = generateVeloriaFamily(draft).household;
    start.locationId = household?.homeId ?? "temple"; start.money = 0; start.inventory = { swaddling_cloth: 1 };
    start.notes = [`Ты рождаешься в 742 КЛ в Ровене: ${NEWBORN_ORIGIN_LABELS[draft.originId] ?? "обычная семья"}.`];
  }
  if (draft.startScenarioId === "journey") {
    start.locationId = "south-gate"; start.money = Math.max(1, start.money - 4);
    start.notes.push("Персонаж прибыл в Ровен после дороги; часть средств ушла на путь.");
  } else if (draft.startScenarioId === "debt-flight") {
    start.locationId = "old-quarter"; start.money = 1;
    start.notes.push("Персонаж скрывается от кредитора; его местонахождение не известно всем автоматически.");
  } else if (draft.startScenarioId === "exile") {
    start.locationId = "south-gate"; start.money = Math.min(start.money, 3);
    start.inventory = { plain_clothes: 1 };
    start.notes.push("Персонаж изгнан; прежние связи сохраняются, но доступ к дому ограничен.");
  } else if (draft.startScenarioId === "captivity-escape") {
    start.locationId = "south-gate"; start.money = 0;
    start.inventory = { plain_clothes: 1 };
    start.notes.push("Персонаж недавно бежал из плена; NPC не знают о побеге без свидетельств.");
  }
  if (draft.familyState === "lost") start.notes.push("Близкие погибли или пропали; точная судьба требует биографической записи.");
  if (draft.familyState === "unknown") start.notes.push("Персонаж не знает достоверно, кто его родители.");
  if (draft.familyState === "chosen-family") start.notes.push("Главные семейные связи — выбранная семья и близкие люди.");
  return { ok: true, start };
}

export function createVeloriaWorldForCharacter(draft: VeloriaCharacterDraft): WorldData | null {
  const result = resolveVeloriaStart(draft);
  if (!result.ok) return null;
  let world = createVeloriaWorld();
  const koronholmSquare = world.locations["atlas:koronholm:square"];
  if (koronholmSquare) world.locations["atlas:koronholm:square"] = { ...koronholmSquare, exits: [...koronholmSquare.exits, { to: "rey:palace-courtyard", distanceM: 180, terrain: "street" }] };
  const startYearKL = draft.dynasticRole === "second-prince" ? SECOND_PRINCE_START_YEAR : 742;
  const court = buildReynarCourt(draft.dynasticRole === "second-prince", startYearKL);
  if (draft.dynasticRole === "second-prince") {
    world = {
      ...world, startYearKL, globalStartId: "koronholm", startLocationId: "rey:royal-nursery", startMoney: 0, startInventory: { swaddling_cloth: 1 },
      items: { ...world.items, swaddling_cloth: { id: "swaddling_cloth", name: "Пелёнка" } },
      npcs: { ...world.npcs, ...court.npcs },
      locations: { ...world.locations, ...court.locations },
      scheduledEvents: [...(world.scheduledEvents ?? []), ...court.events]
    };
  } else {
    world = { ...world, startYearKL, npcs: { ...world.npcs, ...court.npcs }, locations: { ...world.locations, ...court.locations } };
    if (draft.age > 0) world = attachStartEntourage(world, draft.originId);
    else world = { ...world, items: { ...world.items, swaddling_cloth: { id: "swaddling_cloth", name: "Пелёнка" } } };
    world.startLocationId = result.start.locationId;
    world.startMoney = result.start.money;
    world.startInventory = { ...result.start.inventory };
  }
  return world;
}
