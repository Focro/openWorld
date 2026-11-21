/**
 * Наследование внешности для конструктора персонажа.
 * Это модель вымышленного мира, а не биологический или расовый классификатор.
 * Внешность задаётся непрерывными признаками и семейной историей, а не жёсткими «расами».
 */
export type SkinTone = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type HairColor = "black" | "dark-brown" | "brown" | "auburn" | "red" | "blond" | "light-blond" | "grey" | "white";
export type HairTexture = "straight" | "wavy" | "curly" | "coiled";
export type EyeColor = "brown" | "dark-brown" | "hazel" | "green" | "blue" | "grey" | "amber";
export type FacialFeatureSet = "soft" | "angular" | "broad" | "narrow" | "mixed" | "east-asian";

export interface AppearanceProfile {
  skinTone: SkinTone;
  hairColor: HairColor;
  hairTexture: HairTexture;
  eyeColor: EyeColor;
  facialFeatures: FacialFeatureSet;
  /** Дополнительные особенности семьи, если они подтверждены родословной. */
  notes?: string[];
}

export interface ParentHeritage {
  id: string;
  name: string;
  appearance: AppearanceProfile;
  /** Подтверждённые семейные линии; доли условные и нужны только для мира. */
  ancestry?: Record<string, number>;
  /** Известные варианты признаков у родителей/бабушек/дедушек. Неизвестные варианты не выдумываются. */
  familyVariants?: {
    skinToneRange?: [SkinTone, SkinTone];
    hairColors?: HairColor[];
    hairTextures?: HairTexture[];
    eyeColors?: EyeColor[];
    facialFeatures?: FacialFeatureSet[];
  };
}

export interface ChildAppearanceChoice extends AppearanceProfile {
  /** Результат проверки: внешний вид допустим в рамках данных родителей. */
  inheritedFrom: [string, string];
}

const HAIR_COLORS: HairColor[] = ["black", "dark-brown", "brown", "auburn", "red", "blond", "light-blond", "grey", "white"];
const HAIR_TEXTURES: HairTexture[] = ["straight", "wavy", "curly", "coiled"];
const EYE_COLORS: EyeColor[] = ["brown", "dark-brown", "hazel", "green", "blue", "grey", "amber"];
const FACIAL_FEATURES: FacialFeatureSet[] = ["soft", "angular", "broad", "narrow", "mixed", "east-asian"];

function unique<T>(values: T[]): T[] { return [...new Set(values)]; }
function clampTone(value: number): SkinTone { return Math.max(1, Math.min(10, Math.round(value))) as SkinTone; }

/**
 * Условная игровая модель полигенного наследования тона кожи.
 * Диапазон строится по обоим родителям и подтверждённым вариантам в их семьях.
 * Это не расовый классификатор: учитываются конкретные внешние признаки.
 */
export function inheritedSkinToneRange(a: SkinTone, b: SkinTone): [SkinTone, SkinTone] {
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  // Небольшая вариативность допускает промежуточные оттенки,
  // но не позволяет редактору произвольно перескочить к несвязанному фенотипу.
  return [clampTone(low - 1), clampTone(high + 1)];
}

/** Возможные варианты волос/глаз: родительские признаки плюс осторожная вариативность. */
export function inheritedAppearanceOptions(a: ParentHeritage, b: ParentHeritage) {
  const hairColors = unique([a.appearance.hairColor, b.appearance.hairColor, ...(a.familyVariants?.hairColors ?? []), ...(b.familyVariants?.hairColors ?? [])]);
  const eyeColors = unique([a.appearance.eyeColor, b.appearance.eyeColor, ...(a.familyVariants?.eyeColors ?? []), ...(b.familyVariants?.eyeColors ?? [])]);
  const hairTextures = unique([a.appearance.hairTexture, b.appearance.hairTexture, ...(a.familyVariants?.hairTextures ?? []), ...(b.familyVariants?.hairTextures ?? [])]);
  const facialFeatures = unique([
    a.appearance.facialFeatures,
    b.appearance.facialFeatures,
    ...(a.familyVariants?.facialFeatures ?? []),
    ...(b.familyVariants?.facialFeatures ?? []),
    ...(a.appearance.facialFeatures !== b.appearance.facialFeatures ? ["mixed" as const] : [])
  ]);
  const baseRange = inheritedSkinToneRange(a.appearance.skinTone, b.appearance.skinTone);
  const familyRanges = [a.familyVariants?.skinToneRange, b.familyVariants?.skinToneRange].filter((x): x is [SkinTone, SkinTone] => Boolean(x));
  const skinMin = clampTone(Math.min(baseRange[0], ...familyRanges.map(x => x[0])));
  const skinMax = clampTone(Math.max(baseRange[1], ...familyRanges.map(x => x[1])));
  return { skinMin, skinMax, hairColors, eyeColors, hairTextures, facialFeatures };
}

export function validateChildAppearance(
  a: ParentHeritage,
  b: ParentHeritage,
  child: AppearanceProfile
): string[] {
  const options = inheritedAppearanceOptions(a, b);
  const errors: string[] = [];
  if (child.skinTone < options.skinMin || child.skinTone > options.skinMax) {
    errors.push("Тон кожи не укладывается в правдоподобный диапазон наследования от указанных родителей.");
  }
  if (!options.hairColors.includes(child.hairColor)) errors.push("Цвет волос не подтверждается семейными признаками родителей.");
  if (!options.eyeColors.includes(child.eyeColor)) errors.push("Цвет глаз не подтверждается семейными признаками родителей.");
  if (!options.hairTextures.includes(child.hairTexture)) errors.push("Текстура волос не подтверждается семейными признаками родителей.");
  if (!options.facialFeatures.includes(child.facialFeatures)) errors.push("Черты лица не укладываются в доступные варианты наследования.");
  return errors;
}

/**
 * Возвращает варианты внешности только когда известны обе биологические линии.
 * Неизвестный родитель не превращает редактор в «разрешено всё»: доступные сведения
 * сохраняются, а полный диапазон помечается как неопределённый до установления линии.
 */
export function getChildAppearanceOptions(a?: ParentHeritage, b?: ParentHeritage) {
  if (!a || !b) {
    const knownParents = [a, b].filter((parent): parent is ParentHeritage => Boolean(parent));
    return {
      parentsKnown: false as const,
      unrestricted: false as const,
      needsLineageResolution: true as const,
      knownParents: knownParents.map(parent => ({ id: parent.id, name: parent.name })),
      unknownParentCount: 2 - knownParents.length
    };
  }
  return {
    parentsKnown: true as const,
    unrestricted: false as const,
    needsLineageResolution: false as const,
    ...inheritedAppearanceOptions(a, b)
  };
}

/** Небольшие проверки целостности данных родительского профиля для загрузки сохранений. */
export function validateAppearanceProfile(profile: AppearanceProfile): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(profile.skinTone) || profile.skinTone < 1 || profile.skinTone > 10) errors.push("Тон кожи должен быть числом от 1 до 10.");
  if (!HAIR_COLORS.includes(profile.hairColor)) errors.push("Неизвестный цвет волос.");
  if (!HAIR_TEXTURES.includes(profile.hairTexture)) errors.push("Неизвестная текстура волос.");
  if (!EYE_COLORS.includes(profile.eyeColor)) errors.push("Неизвестный цвет глаз.");
  if (!FACIAL_FEATURES.includes(profile.facialFeatures)) errors.push("Неизвестный тип черт лица.");
  return errors;
}
