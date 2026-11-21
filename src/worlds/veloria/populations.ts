/**
 * Население шести государств Ардана: типичная внешность и имена.
 *
 * Правило мира (согласовано с автором, 0.14.0): у каждой страны свой преобладающий облик,
 * как в реальном мире у народов разных земель. Люди другого происхождения встречаются,
 * но редко; чаще в портах, столицах и на торговых путях.
 *
 * Это игровая модель распределения признаков, а не классификатор. Внешность ничего не
 * говорит о характере, уме или способностях; ребёнок по-прежнему наследует признаки
 * от конкретных родителей (heritage.ts), а не «от страны».
 *
 * Статус: предложение проекта на основе канона (климат, культура, имена домов в nobleHouses.ts).
 */
import type { AppearanceProfile, EyeColor, FacialFeatureSet, HairColor, HairTexture, SkinTone } from "./heritage";

export type StateId = "estran" | "sahrad" | "tharvek" | "varent" | "elyndor" | "kharum";
export const STATE_IDS: StateId[] = ["estran", "sahrad", "tharvek", "varent", "elyndor", "kharum"];
export const isStateId = (value: string): value is StateId => (STATE_IDS as string[]).includes(value);

type Weighted<T> = ReadonlyArray<readonly [T, number]>;

export interface PopulationProfile {
  stateId: StateId;
  /** Как в мире называют местный облик; используется в описаниях и подсказках. */
  description: string;
  skinTone: Weighted<SkinTone>;
  hairColor: Weighted<HairColor>;
  hairTexture: Weighted<HairTexture>;
  eyeColor: Weighted<EyeColor>;
  facialFeatures: Weighted<FacialFeatureSet>;
  /** Доля людей иного происхождения в обычном поселении (0–1). */
  foreignShare: number;
  /** Откуда чаще всего приезжают чужеземцы: соседи и торговые партнёры. */
  foreignSources: Weighted<StateId>;
  names: { masculine: string[]; feminine: string[]; surnames: string[]; pattern: "given-surname" | "given-of-father" | "surname-given" };
}

export const POPULATIONS: Record<StateId, PopulationProfile> = {
  estran: {
    stateId: "estran",
    description: "Светлая кожа, волосы от русых и каштановых до светлых, глаза серые, голубые, ореховые или карие.",
    skinTone: [[1, 2], [2, 5], [3, 3]],
    hairColor: [["brown", 5], ["dark-brown", 3], ["blond", 3], ["light-blond", 2], ["auburn", 1.5], ["red", 0.5], ["black", 0.5]],
    hairTexture: [["straight", 5], ["wavy", 4], ["curly", 1]],
    eyeColor: [["grey", 3], ["blue", 3], ["hazel", 2], ["brown", 2], ["green", 1.5], ["dark-brown", 0.5]],
    facialFeatures: [["soft", 3], ["angular", 3], ["narrow", 2], ["broad", 2]],
    foreignShare: 0.04,
    foreignSources: [["varent", 4], ["tharvek", 3], ["elyndor", 2], ["sahrad", 1], ["kharum", 0.5]],
    names: {
      masculine: ["Эдрен", "Тален", "Остен", "Йорен", "Леван", "Ренар", "Орест", "Бран", "Матис", "Адриен", "Томас", "Эдмунд", "Гарет", "Освин", "Роланд", "Хьюго"],
      feminine: ["Ива", "Нера", "Сера", "Мира", "Лина", "Эна", "Вейра", "Адела", "Люция", "Герда", "Элин", "Мэйбл", "Розамунда", "Аделина", "Бренна", "Клара"],
      surnames: ["Норрен", "Сорел", "Элвин", "Вейл", "Келлер", "Мерр", "Ровен", "Бартон", "Хейл", "Фенвик", "Ашфорд", "Линдел", "Кроу", "Миллер", "Торн", "Уэйд"],
      pattern: "given-surname"
    }
  },
  elyndor: {
    stateId: "elyndor",
    description: "Очень светлая кожа, светлые или пепельно-русые волосы, глаза голубые, серые или зелёные; черты часто мягкие и широкоскулые.",
    skinTone: [[1, 6], [2, 3]],
    hairColor: [["light-blond", 5], ["blond", 4], ["brown", 1.5], ["auburn", 0.7], ["red", 0.5], ["dark-brown", 0.3]],
    hairTexture: [["straight", 6], ["wavy", 3]],
    eyeColor: [["blue", 4], ["grey", 4], ["green", 2], ["hazel", 0.5]],
    facialFeatures: [["soft", 3], ["broad", 3], ["angular", 2], ["narrow", 1]],
    foreignShare: 0.02,
    foreignSources: [["estran", 3], ["tharvek", 2], ["varent", 1]],
    names: {
      masculine: ["Тир", "Аран", "Йор", "Сил", "Орн", "Вейн", "Лиар", "Кай", "Эриль", "Тейво", "Ильмар", "Сейни", "Аэрт", "Вейко", "Лаури", "Ханно"],
      feminine: ["Лира", "Эна", "Ара", "Мира", "Сель", "Нел", "Элен", "Айни", "Сиэль", "Тувия", "Ильва", "Кайса", "Лиэн", "Вейла", "Иинэ", "Риэна"],
      surnames: ["Ива", "Терн", "Ларет", "Сильвар", "Эльтир", "Озерный", "Мшистый", "Рябин", "Ольховый", "Камышов", "Сосновый", "Брусничный"],
      pattern: "given-surname"
    }
  },
  tharvek: {
    stateId: "tharvek",
    description: "Светлая или оливковая кожа, тёмные густые волосы, карие, ореховые или серые глаза; черты чаще резкие, с выраженным носом и скулами.",
    skinTone: [[2, 3], [3, 4], [4, 2]],
    hairColor: [["dark-brown", 5], ["black", 3], ["brown", 3], ["auburn", 0.7], ["blond", 0.5]],
    hairTexture: [["wavy", 4], ["straight", 4], ["curly", 2]],
    eyeColor: [["brown", 4], ["hazel", 3], ["dark-brown", 2], ["grey", 2], ["green", 1]],
    facialFeatures: [["angular", 5], ["narrow", 2], ["broad", 2], ["soft", 1]],
    foreignShare: 0.03,
    foreignSources: [["estran", 3], ["elyndor", 2], ["sahrad", 1], ["kharum", 1]],
    names: {
      masculine: ["Дорн", "Марек", "Орран", "Корн", "Руд", "Сорен", "Тор", "Лев", "Ивар", "Дер", "Кел", "Бранко", "Здеслав", "Велько", "Радим", "Гойко"],
      feminine: ["Ильда", "Мейв", "Айна", "Сель", "Тесса", "Элла", "Нива", "Ая", "Хельма", "Драгана", "Весна", "Мила", "Ружа", "Злата", "Ведрана", "Горана"],
      surnames: ["Кельд", "Дравик", "Варк", "Камнев", "Перевальный", "Рудной", "Скалич", "Горач", "Железняк", "Кремень", "Обвал", "Уступ"],
      pattern: "given-surname"
    }
  },
  varent: {
    stateId: "varent",
    description: "Оливковая или смуглая кожа, тёмные волнистые волосы, карие или ореховые глаза; в гаванях заметно смешение с приезжими.",
    skinTone: [[3, 3], [4, 4], [5, 2], [2, 1]],
    hairColor: [["dark-brown", 5], ["black", 4], ["brown", 3], ["auburn", 0.5], ["blond", 0.5]],
    hairTexture: [["wavy", 5], ["curly", 3], ["straight", 2]],
    eyeColor: [["brown", 4], ["dark-brown", 3], ["hazel", 3], ["green", 1], ["grey", 0.5]],
    facialFeatures: [["angular", 3], ["soft", 3], ["narrow", 2], ["broad", 1]],
    foreignShare: 0.12,
    foreignSources: [["estran", 3], ["sahrad", 3], ["kharum", 2], ["tharvek", 1], ["elyndor", 1]],
    names: {
      masculine: ["Виктор", "Йорен", "Аран", "Рон", "Ян", "Кель", "Там", "Сар", "Лоренцо", "Марино", "Дарио", "Северо", "Тиберио", "Нико", "Альвизе", "Пьетро"],
      feminine: ["Лина", "Элис", "Ада", "Селия", "Ира", "Мел", "Ава", "Ви", "Лен", "Кьяра", "Беатрис", "Оттавия", "Сильвана", "Марина", "Флавия", "Джулия"],
      surnames: ["Меровар", "Лорент", "Велл", "Сорелл", "Нарель", "Кантарини", "Малверди", "Скали", "Оливаро", "Бруно", "Тессари", "Дзенон"],
      pattern: "given-surname"
    }
  },
  sahrad: {
    stateId: "sahrad",
    description: "Смуглая кожа от золотистой до тёмной, чёрные или тёмно-каштановые волосы, тёмные глаза; черты узкие и выразительные.",
    skinTone: [[4, 3], [5, 4], [6, 3], [7, 1.5]],
    hairColor: [["black", 6], ["dark-brown", 4]],
    hairTexture: [["wavy", 4], ["curly", 3], ["straight", 2], ["coiled", 0.7]],
    eyeColor: [["dark-brown", 5], ["brown", 4], ["hazel", 1], ["amber", 0.5], ["green", 0.3]],
    facialFeatures: [["narrow", 4], ["angular", 3], ["soft", 2]],
    foreignShare: 0.04,
    foreignSources: [["varent", 3], ["kharum", 3], ["tharvek", 1], ["estran", 1]],
    names: {
      masculine: ["Рашид", "Надир", "Фарид", "Амин", "Джал", "Адель", "Умар", "Тарик", "Салим", "Рами", "Юсуф", "Касим", "Саид", "Идрис", "Хасан", "Малик"],
      feminine: ["Самира", "Лейла", "Рима", "Нур", "Хана", "Мариам", "Зара", "Сафа", "Амина", "Яра", "Дара", "Фатима", "Ясмин", "Лубна", "Сальма", "Айша"],
      surnames: ["аль-Кади", "Сахра", "Кадир", "Азхар", "Мирджан", "аль-Бир", "ибн Сайф", "аль-Мельх", "Хаддад", "аль-Вади", "Наххас", "Зарраф"],
      pattern: "given-of-father"
    }
  },
  kharum: {
    stateId: "kharum",
    description: "Кожа от светло-золотистой до смуглой, прямые чёрные волосы, тёмно-карие глаза, восточноазиатские черты лица.",
    skinTone: [[3, 3], [4, 4], [5, 3], [6, 1]],
    hairColor: [["black", 8], ["dark-brown", 2]],
    hairTexture: [["straight", 8], ["wavy", 1.5]],
    eyeColor: [["dark-brown", 7], ["brown", 3]],
    facialFeatures: [["east-asian", 10]],
    foreignShare: 0.03,
    foreignSources: [["sahrad", 3], ["varent", 2], ["tharvek", 1]],
    names: {
      masculine: ["Вэй", "Джун", "Чэнь", "Янь", "Тао", "Кай", "Лэй", "Цзе", "Сюй", "Чжоу", "Лян", "Хао", "Минь", "Бо", "Шэн", "Юань"],
      feminine: ["Мэй", "Лин", "Мин", "Лу", "Ми", "Ся", "Сюэ", "Лань", "Хуа", "Цин", "Юй", "Фэн", "Жун", "Нин", "Яо", "Сяо"],
      surnames: ["Камар", "Азракар", "Шурен", "Линхай", "Хань", "Цзян", "Мо", "Бай", "Гу", "Сун", "Тан", "Лю"],
      pattern: "surname-given"
    }
  }
};

/** Детерминированный хэш строки (FNV-1a). */
export function seedHash(value: string): number {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) { result ^= value.charCodeAt(i); result = Math.imul(result, 16777619); }
  return result >>> 0;
}
const unit = (seed: string) => seedHash(seed) / 4294967296;

function pickWeighted<T>(items: Weighted<T>, seed: string): T {
  const total = items.reduce((sum, [, w]) => sum + w, 0);
  let roll = unit(seed) * total;
  for (const [value, weight] of items) { roll -= weight; if (roll < 0) return value; }
  return items[items.length - 1]![0];
}
export const pickFrom = <T>(values: readonly T[], seed: string): T => values[seedHash(seed) % values.length]!;

/** Типичная для страны внешность (без учёта приезжих). */
export function sampleNativeAppearance(stateId: StateId, seed: string): AppearanceProfile {
  const p = POPULATIONS[stateId];
  return {
    skinTone: pickWeighted(p.skinTone, `${seed}:skin`),
    hairColor: pickWeighted(p.hairColor, `${seed}:hair`),
    hairTexture: pickWeighted(p.hairTexture, `${seed}:texture`),
    eyeColor: pickWeighted(p.eyeColor, `${seed}:eyes`),
    facialFeatures: pickWeighted(p.facialFeatures, `${seed}:face`)
  };
}

export interface ResidentOrigin { stateId: StateId; foreign: boolean }

/** Откуда родом житель поселения: чаще местный, иногда приезжий. В портах и столицах приезжих больше. */
export function residentOrigin(stateId: StateId, seed: string, kind: "village" | "town" | "city" | "capital" | "port" = "town"): ResidentOrigin {
  const p = POPULATIONS[stateId];
  const multiplier = kind === "port" ? 2.5 : kind === "capital" ? 2 : kind === "city" ? 1.5 : kind === "village" ? 0.3 : 1;
  const share = Math.min(0.35, p.foreignShare * multiplier);
  if (unit(`${seed}:foreign`) >= share) return { stateId, foreign: false };
  return { stateId: pickWeighted(p.foreignSources, `${seed}:from`), foreign: true };
}

/** Внешность жителя с учётом возможного иного происхождения. */
export function sampleResidentAppearance(stateId: StateId, seed: string, kind?: Parameters<typeof residentOrigin>[2]): AppearanceProfile & { originStateId: StateId } {
  const origin = residentOrigin(stateId, seed, kind);
  return { ...sampleNativeAppearance(origin.stateId, seed), originStateId: origin.stateId };
}

/** Имя по традиции страны. Пол задаётся явно; фамилию можно передать, чтобы семья носила одну. */
export function regionalName(stateId: StateId, sex: "male" | "female", seed: string, surname?: string, fatherGiven?: string): { given: string; surname: string; full: string } {
  const n = POPULATIONS[stateId].names;
  const given = pickFrom(sex === "male" ? n.masculine : n.feminine, `${seed}:given`);
  const family = surname ?? pickFrom(n.surnames, `${seed}:surname`);
  if (n.pattern === "surname-given") return { given, surname: family, full: `${family} ${given}` };
  if (n.pattern === "given-of-father" && fatherGiven) return { given, surname: family, full: `${given} ${sex === "male" ? "ибн" : "бинт"} ${fatherGiven} ${family}` };
  return { given, surname: family, full: `${given} ${family}` };
}

/** Насколько внешность типична для страны: доля признаков, которые встречаются в местной палитре. */
export function nativeFit(stateId: StateId, appearance: AppearanceProfile): number {
  const p = POPULATIONS[stateId];
  const has = <T>(list: Weighted<T>, value: T) => list.some(([v]) => v === value);
  const checks = [has(p.skinTone, appearance.skinTone), has(p.hairColor, appearance.hairColor), has(p.hairTexture, appearance.hairTexture), has(p.eyeColor, appearance.eyeColor), has(p.facialFeatures, appearance.facialFeatures)];
  return checks.filter(Boolean).length / checks.length;
}
