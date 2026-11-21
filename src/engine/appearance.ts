/**
 * Устойчивая внешность персонажей.
 * Биологические признаки неизменяемы; меняются только причёска, одежда,
 * состояние тела и видимые следы событий. NPC запоминают только то, что увидели.
 */
export interface AppearanceIdentity {
  readonly skinTone?: number;
  readonly eyeColor?: string;
  readonly naturalHairColor?: string;
  readonly hairTexture?: string;
  readonly facialFeatures?: string;
  /** Прочие подтверждённые при создании устойчивые особенности. */
  readonly description?: string;
}

export interface AppearanceWound {
  id: string;
  description: string;
  location: string;
  leavesScar: boolean;
  receivedAt: number;
}

export interface AppearanceScar {
  id: string;
  description: string;
  location: string;
  formedAt: number;
  /** Шрам постоянен; удаление возможно только отдельной подтверждённой медицинской механикой. */
  permanent: true;
}

export type ClothingCondition = "wrinkled" | "dirty" | "torn" | "wet" | "poorly-fastened";

export interface CharacterAppearanceState {
  /** Наследуемые и биологические признаки. Игровые действия не могут их переписать. */
  readonly identity: AppearanceIdentity;
  /** Текущий вид: эти параметры могут меняться событиями мира. */
  hairstyle: string;
  facialHair?: string;
  clothing: string;
  /** Наблюдаемые состояния одежды, не сводимые к её названию. */
  clothingConditions: ClothingCondition[];
  cleanliness?: "clean" | "ordinary" | "dirty";
  wounds: AppearanceWound[];
  scars: AppearanceScar[];
  revision: number;
}

export interface AppearanceObservation {
  observerId: string;
  subjectId: "player" | string;
  observedAt: number;
  locationId: string;
  revision: number;
  snapshot: string;
}

export type AppearanceChange =
  | { type: "haircut"; hairstyle: string }
  | { type: "change-clothing"; clothing: string }
  | { type: "get-wounded"; wound: AppearanceWound }
  | { type: "heal-wound"; woundId: string; healedAt: number }
  | { type: "set-cleanliness"; cleanliness: "clean" | "ordinary" | "dirty" }
  | { type: "set-clothing-condition"; condition: ClothingCondition; active: boolean };

export function validateAppearanceIdentity(identity: AppearanceIdentity): string[] {
  const errors: string[] = [];
  if (identity.skinTone !== undefined && (!Number.isInteger(identity.skinTone) || identity.skinTone < 1 || identity.skinTone > 10)) {
    errors.push("Тон кожи должен быть целым значением от 1 до 10.");
  }
  const limits: Array<[keyof AppearanceIdentity, number]> = [
    ["eyeColor", 40], ["naturalHairColor", 60], ["hairTexture", 40], ["facialFeatures", 100], ["description", 600]
  ];
  for (const [key, max] of limits) {
    const value = identity[key];
    if (value !== undefined && (typeof value !== "string" || value.length > max)) {
      errors.push(`Поле внешности «${key}» превышает допустимую длину или имеет неверный тип.`);
    }
  }
  return errors;
}

export function createAppearanceState(
  identity: AppearanceIdentity,
  options: { hairstyle: string; clothing: string }
): CharacterAppearanceState {
  const identityErrors = validateAppearanceIdentity(identity);
  if (identityErrors.length) throw new Error(identityErrors.join(" "));
  if (identity.description && !isNonInheritedAppearanceDescriptionAllowed(identity.description)) {
    throw new Error("Дополнительное описание не может подменять наследуемые цветовые признаки.");
  }
  if (!options.hairstyle.trim() || options.hairstyle.length > 100 || !isHaircutDescriptionAllowed(options.hairstyle)) throw new Error("Причёска должна описывать форму и длину, а не менять природный цвет волос.");
  if (!options.clothing.trim() || options.clothing.length > 160) throw new Error("Некорректное описание одежды.");
  return {
    // Замораживаем биологическую идентичность в runtime: это не просто поле UI.
    identity: Object.freeze({ ...identity }), hairstyle: options.hairstyle.trim(), clothing: options.clothing.trim(),
    wounds: [], scars: [], clothingConditions: [], revision: 0, cleanliness: "ordinary"
  };
}

/** Свободная заметка может описывать отметины/осанку, но не подменять наследуемый фенотип. */
export function isNonInheritedAppearanceDescriptionAllowed(value: string): boolean {
  return !/(цвет\s+кожи|тон\s+кожи|цвет\s+глаз|цвет\s+волос|skin\s+tone|eye\s+colou?r|hair\s+colou?r|глаза\s+(?:голуб|син|зел|кар|сер|янтар|чёрн|черн)|(?:голуб(?:ые|ая|ой|ое)?|син(?:ие|яя|ий|ее)?|зел(?:ёные|еные|ёная|еная|ёный|еный|ёное|еное)|кар(?:ие|яя|ий|ее)|сер(?:ые|ая|ый|ое)|янтар(?:ные|ная|ный|ное)|чёрн(?:ые|ая|ый|ое)|черн(?:ые|ая|ый|ое))\s+глаз|волосы\s+(?:чёрн|черн|бел|блон|светл|т[её]мн|каштан|рыж|рус|сед)|(?:чёрные|чёрная|чёрный|чёрное|черные|черная|черный|черное|белые|белая|белый|белое|блондинистые|светлые|светлая|светлый|светлое|тёмные|тёмная|тёмный|тёмное|темные|темная|темный|темное|каштановые|рыжие|рыжая|рыжий|русые|русая|седые|седая)\s+волос|(?:black|white|blond|blonde|red|ginger|brown|grey|gray)\s+hair|(?:blue|green|brown|grey|gray|hazel|amber)\s+eyes|чернокож|белокож|кожа\s+(?:светл|т[её]мн|чёрн|черн|бел)|(?:светлая|светлый|тёмная|тёмный|темная|темный|чёрная|чёрный|черная|черный|белая|белый)\s+кожа|форма\s+лица|черты\s+лица|азиат|европей|европеоид|африкан|афро|славян|тюрк|семит|монголоид|негроид)/i.test(value);
}

/** Повторно закрепляет неизменяемую биологическую идентичность после загрузки/клонирования сохранения. */
export function lockAppearanceIdentity<T extends CharacterAppearanceState>(state: T): T {
  return { ...state, identity: Object.freeze({ ...state.identity }) };
}

/** Стрижка меняет форму/длину причёски, но не окраску волос. */
export function isHaircutDescriptionAllowed(value: string): boolean {
  const text = value.toLocaleLowerCase("ru-RU");
  return !/(покрас|перекрас|окрас|обесцвет|осветл|затемн|сменить\s+цвет|изменить\s+цвет|dye|recolor|bleach|\b(?:black|white|blond|blonde|red|ginger|brown|grey|gray|blue|green)\b|черн|бел(?:ые|ая|ый|ое)?|блондин|светл(?:ые|ая|ый|ое)?|т[её]мн(?:ые|ая|ый|ое)?|каштан|рыж|рус(?:ые|ая|ый|ое)?|сед(?:ые|ая|ый|ое)?|серебр|пепел|коричнев|сер(?:ые|ая|ый|ое)|золот|син(?:ие|яя|ий|ее)?|голуб(?:ые|ая|ой|ое)?|зел(?:ёные|еные|ёная|ёный|ёное)|красн(?:ые|ая|ый|ое)?)/i.test(text);
}

/** Единственная разрешённая точка изменения текущей внешности. */
export function applyAppearanceChange(
  current: CharacterAppearanceState,
  change: AppearanceChange
): CharacterAppearanceState | null {
  switch (change.type) {
    case "haircut":
      if (!change.hairstyle.trim() || change.hairstyle.length > 100 || !isHaircutDescriptionAllowed(change.hairstyle)) return null;
      return { ...current, hairstyle: change.hairstyle.trim(), revision: current.revision + 1 };
    case "change-clothing":
      if (!change.clothing.trim() || change.clothing.length > 160) return null;
      // Состояние старой одежды не переносится на новый комплект.
      return { ...current, clothing: change.clothing.trim(), clothingConditions: [], revision: current.revision + 1 };
    case "get-wounded":
      if (!change.wound.id.trim() || change.wound.id.length > 64 || !change.wound.description.trim() || change.wound.description.length > 160 ||
          !change.wound.location.trim() || change.wound.location.length > 80 || typeof change.wound.leavesScar !== "boolean" ||
          !Number.isFinite(change.wound.receivedAt) || change.wound.receivedAt < 0 ||
          current.wounds.some(w => w.id === change.wound.id) || current.scars.some(s => s.id === change.wound.id)) return null;
      return { ...current, wounds: [...current.wounds, { ...change.wound }], revision: current.revision + 1 };
    case "heal-wound": {
      const wound = current.wounds.find(w => w.id === change.woundId);
      if (!wound || !Number.isFinite(change.healedAt) || change.healedAt < wound.receivedAt) return null;
      const wounds = current.wounds.filter(w => w.id !== change.woundId);
      const scars = wound.leavesScar
        ? [...current.scars, { id: wound.id, description: wound.description, location: wound.location, formedAt: change.healedAt, permanent: true as const }]
        : current.scars;
      return { ...current, wounds, scars, revision: current.revision + 1 };
    }
    case "set-cleanliness":
      if (!["clean", "ordinary", "dirty"].includes(change.cleanliness)) return null;
      return { ...current, cleanliness: change.cleanliness, revision: current.revision + 1 };
    case "set-clothing-condition": {
      const allowed: ClothingCondition[] = ["wrinkled", "dirty", "torn", "wet", "poorly-fastened"];
      if (!allowed.includes(change.condition) || typeof change.active !== "boolean") return null;
      const existingConditions = current.clothingConditions ?? [];
      const clothingConditions = change.active
        ? [...new Set([...existingConditions, change.condition])]
        : existingConditions.filter(condition => condition !== change.condition);
      return { ...current, clothingConditions, revision: current.revision + 1 };
    }
    default:
      return null;
  }
}

/** Биологические признаки намеренно не входят в список изменяемых действий. */
function localizeAppearanceValue(value: string | undefined, map: Record<string, string>): string | undefined {
  if (!value) return undefined;
  return map[value] ?? value;
}

export function describeAppearance(state: CharacterAppearanceState): string {
  // Совместимость со старыми сохранениями до появления clothingConditions.
  const clothingConditions = state.clothingConditions ?? [];
  const identity = [
    state.identity.skinTone === undefined ? undefined : `тон кожи ${state.identity.skinTone}`,
    state.identity.eyeColor ? (state.identity.eyeColor === "green" ? "зелёные глаза" : `глаза: ${localizeAppearanceValue(state.identity.eyeColor, { brown: "карие", "dark-brown": "тёмно-карие", hazel: "ореховые", blue: "голубые", grey: "серые", amber: "янтарные" })}`) : undefined,
    state.identity.naturalHairColor ? `природные волосы: ${localizeAppearanceValue(state.identity.naturalHairColor, { black: "чёрные", "dark-brown": "тёмно-каштановые", brown: "каштановые", auburn: "рыжевато-каштановые", red: "рыжие", blond: "русые", "light-blond": "светло-русые", grey: "седые", white: "белые" })}` : undefined,
    state.identity.hairTexture ? `текстура волос: ${localizeAppearanceValue(state.identity.hairTexture, { straight: "прямые", wavy: "волнистые", curly: "кудрявые", coiled: "очень кудрявые" })}` : undefined,
    state.identity.facialFeatures ? `черты лица: ${localizeAppearanceValue(state.identity.facialFeatures, { soft: "мягкие", angular: "угловатые", broad: "широкие", narrow: "узкие", mixed: "сочетание черт родителей", "east-asian": "выраженные восточноазиатские" })}` : undefined,
    state.identity.description
  ].filter(Boolean);
  const current = [
    `причёска: ${state.hairstyle}`,
    state.facialHair ? `растительность на лице: ${state.facialHair}` : undefined,
    `одежда: ${state.clothing}`,
    clothingConditions.length ? `состояние одежды: ${clothingConditions.map(condition => ({ wrinkled: "помята", dirty: "испачкана", torn: "порвана", wet: "мокрая", "poorly-fastened": "небрежно застёгнута" } as Record<ClothingCondition, string>)[condition]).join(", ")}` : undefined,
    state.cleanliness === "dirty" ? "одежда и тело испачканы" : state.cleanliness === "clean" ? "выглядит опрятно" : undefined,
    state.wounds.length ? `незажившие раны: ${state.wounds.map(w => `${w.location} (${w.description})`).join(", ")}` : undefined,
    state.scars.length ? `шрамы: ${state.scars.map(s => `${s.location} (${s.description})`).join(", ")}` : undefined
  ].filter(Boolean);
  return [...identity, ...current].join("; ");
}

/** Снимок фиксируется у конкретного наблюдателя и не обновляется, пока тот снова не увидит героя. */
export function observeAppearance(
  observerId: string, subjectId: string, minute: number, locationId: string,
  appearance: CharacterAppearanceState
): AppearanceObservation {
  return {
    observerId, subjectId, observedAt: minute, locationId,
    revision: appearance.revision, snapshot: describeAppearance(appearance)
  };
}
