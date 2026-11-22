/**
 * Жизненные этапы и развитие персонажа от рождения.
 *
 * Модуль не зависит от конкретного мира: он работает с GameState и WorldData,
 * поэтому подходит и для Велории, и для будущих миров.
 *
 * Принципы:
 * - возраст считается от минуты рождения, а не от счётчика «лет»;
 * - развитие нелинейное: у каждого ребёнка свой темп в каждой области
 *   (движение, речь, социальное развитие, мышление), и он зависит от задатков,
 *   здоровья, питания и того, кто реально заботится о ребёнке;
 * - характер не выбирается целиком: игрок задаёт врождённый темперамент,
 *   а черты личности формируются постепенно из опыта;
 * - время обрабатывается день за днём, важные события не пропускаются.
 */
import type { GameState, NpcDef, NpcHabit, PersonalityTraits, WorldData } from "./types";
import { MINUTES_PER_DAY } from "./time";
import { npcsAt } from "./world";

export const DAYS_PER_YEAR = 365;
export const MINUTES_PER_YEAR = DAYS_PER_YEAR * MINUTES_PER_DAY;
export const DAYS_PER_MONTH = DAYS_PER_YEAR / 12;

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round1 = (value: number) => Math.round(value * 10) / 10;

// ---------------------------------------------------------------------------
// Жизненные этапы
// ---------------------------------------------------------------------------

export type LifeStageId = "infancy" | "early-childhood" | "childhood" | "adolescence" | "youth" | "adulthood" | "elder";

export interface LifeStageDef {
  id: LifeStageId;
  label: string;
  /** Начало этапа в месяцах жизни (включительно). */
  fromMonths: number;
  summary: string;
}

export const LIFE_STAGES: LifeStageDef[] = [
  { id: "infancy", label: "Младенчество", fromMonths: 0, summary: "Сон, кормление, плач, узнавание голосов и лиц, привязанность к тем, кто рядом." },
  { id: "early-childhood", label: "Раннее детство", fromMonths: 18, summary: "Уверенная ходьба, первые слова и фразы, первые воспоминания, простые действия." },
  { id: "childhood", label: "Детство", fromMonths: 72, summary: "Обучение, игры, дружба и ссоры, привычки, понимание правил своего круга." },
  { id: "adolescence", label: "Подростковый возраст", fromMonths: 144, summary: "Самостоятельность, личные убеждения, конфликты со старшими, начало обучения делу." },
  { id: "youth", label: "Юность", fromMonths: 192, summary: "Выбор пути, первые взрослые обязанности, отношения, место в обществе." },
  { id: "adulthood", label: "Взрослая жизнь", fromMonths: 252, summary: "Профессия, семья, имущество, власть и ответственность." },
  { id: "elder", label: "Старость", fromMonths: 720, summary: "Опыт и влияние при постепенном снижении сил и здоровья." }
];

export function lifeStageForMonths(months: number): LifeStageDef {
  let current = LIFE_STAGES[0]!;
  for (const stage of LIFE_STAGES) if (months >= stage.fromMonths) current = stage;
  return current;
}

// ---------------------------------------------------------------------------
// Вехи развития
// ---------------------------------------------------------------------------

export type DevelopmentDomain = "motor" | "language" | "social" | "cognitive";
export type MilestoneId =
  | "social-smile" | "knows-voices" | "knows-faces" | "sits" | "stranger-wariness" | "crawls"
  | "first-word" | "first-steps" | "walks-steadily" | "two-word-phrases" | "lasting-memories"
  | "simple-sentences" | "fluent-speech" | "social-rules" | "abstract-thinking";

export interface MilestoneDef {
  id: MilestoneId;
  label: string;
  domain: DevelopmentDomain;
  /** Типичный «возраст развития» в месяцах. Реальный возраст наступления зависит от темпа. */
  typicalMonths: number;
  /** Что вехa открывает игроку. */
  unlocks: string;
}

export const MILESTONES: MilestoneDef[] = [
  { id: "social-smile", label: "Первая осознанная улыбка", domain: "social", typicalMonths: 1.5, unlocks: "можно улыбаться знакомым людям" },
  { id: "knows-voices", label: "Узнаёт знакомые голоса", domain: "social", typicalMonths: 3, unlocks: "успокаивается от голоса близких" },
  { id: "knows-faces", label: "Узнаёт знакомые лица", domain: "cognitive", typicalMonths: 4.5, unlocks: "можно тянуться к знакомому человеку" },
  { id: "sits", label: "Сидит без поддержки", domain: "motor", typicalMonths: 6.5, unlocks: "можно хватать и рассматривать предметы" },
  { id: "stranger-wariness", label: "Настороженность к чужим", domain: "social", typicalMonths: 8, unlocks: "отсутствие близких и чужие люди вызывают тревогу" },
  { id: "crawls", label: "Ползает", domain: "motor", typicalMonths: 8.5, unlocks: "можно перемещаться в пределах комнаты" },
  { id: "first-word", label: "Первое слово", domain: "language", typicalMonths: 12, unlocks: "можно произносить отдельные слова" },
  { id: "first-steps", label: "Первые шаги", domain: "motor", typicalMonths: 12.5, unlocks: "можно делать несколько шагов с опорой" },
  { id: "walks-steadily", label: "Уверенно ходит", domain: "motor", typicalMonths: 17, unlocks: "можно ходить по дому под присмотром" },
  { id: "two-word-phrases", label: "Фразы из двух-трёх слов", domain: "language", typicalMonths: 22, unlocks: "короткие фразы до трёх слов" },
  { id: "lasting-memories", label: "Первые связные воспоминания", domain: "cognitive", typicalMonths: 40, unlocks: "события начинают запоминаться надолго" },
  { id: "simple-sentences", label: "Простые предложения", domain: "language", typicalMonths: 34, unlocks: "предложения до шести слов" },
  { id: "fluent-speech", label: "Связная речь", domain: "language", typicalMonths: 54, unlocks: "свободная речь без ограничения длины" },
  { id: "social-rules", label: "Понимает правила своего круга", domain: "social", typicalMonths: 70, unlocks: "осознаёт иерархию, приличия и запреты" },
  { id: "abstract-thinking", label: "Отвлечённое мышление", domain: "cognitive", typicalMonths: 140, unlocks: "убеждения, политика, сложные рассуждения" }
];
export const milestoneById = (id: MilestoneId) => MILESTONES.find(m => m.id === id)!;

// ---------------------------------------------------------------------------
// Состояние развития
// ---------------------------------------------------------------------------

/** Врождённый темперамент (0..100). Это фундамент, а не готовый характер. */
export interface Temperament {
  /** Подвижность, потребность в действии. */
  activity: number;
  /** Чувствительность к шуму, холоду, интонации, чужим эмоциям. */
  sensitivity: number;
  /** Стремление к людям или осторожность к новому. */
  approach: number;
  /** Насколько легко привыкает к переменам. */
  adaptability: number;
  /** Сила эмоциональных реакций. */
  intensity: number;
  /** Преобладающее настроение: от тревожно-хмурого до светлого. */
  mood: number;
}

export type BodyBuild = "slender" | "average" | "sturdy";
export type HeightTendency = "short" | "average" | "tall";

export interface Attachment {
  /** Насколько ребёнок чувствует себя в безопасности рядом с этим человеком. */
  security: number;
  /** Насколько хорошо знает этого человека. */
  familiarity: number;
  /** Настороженность: накапливается от холодности, резкости, страха. */
  wariness: number;
  lastContactMinute: number;
  /** Человек умер или исчез из жизни ребёнка. */
  lost?: boolean;
}

export interface FormativeExperience {
  minute: number;
  text: string;
  tag: string;
  /** Насколько сильно опыт влияет на формирование характера. */
  weight: number;
  /** Пережит ли опыт до появления связных воспоминаний. */
  preverbal: boolean;
}

export interface DevelopmentState {
  version: 1;
  /** Абсолютная минута рождения в шкале кампании (может быть отрицательной). */
  birthMinute: number;
  lastProcessedMinute: number;
  sex: "male" | "female" | "unspecified";
  temperament: Temperament;
  /** Задатки 1..30 из анкеты: потолок, а не нынешний уровень. */
  aptitudes: Record<string, number>;
  /** Индивидуальный темп по областям, примерно 0.75..1.3. */
  pace: Record<DevelopmentDomain, number>;
  /** Накопленный «возраст развития» по областям, в месяцах. */
  developmentalMonths: Record<DevelopmentDomain, number>;
  milestones: Partial<Record<MilestoneId, number>>;
  physical: {
    heightCm: number;
    weightKg: number;
    build: BodyBuild;
    heightTendency: HeightTendency;
    /** 0..100 */
    health: number;
    /** 0..100, средняя сытость за последние дни. */
    nutrition: number;
    /** Накопленный дефицит роста от недоедания и болезней, см. */
    growthDeficitCm: number;
  };
  /** Потребности, важные прежде всего в младенчестве. 0: удовлетворено, 100: острая нужда. */
  needs: { hunger: number; tiredness: number; distress: number };
  /** Последняя минута сна/кормления для отображения. */
  lastFedMinute: number;
  lastSleptMinute: number;
  attachments: Record<string, Attachment>;
  experiences: FormativeExperience[];
  /** Сформированные черты личности игрока (0..100). */
  traits: PersonalityTraits;
  /** Ещё не усвоенное влияние опыта: применяется постепенно, а не мгновенно. */
  pendingInfluence: Partial<Record<keyof PersonalityTraits, number>>;
  habits: NpcHabit[];
}

export interface DevelopmentSetup {
  birthMinute: number;
  sex?: DevelopmentState["sex"];
  temperament?: Partial<Temperament>;
  aptitudes: Record<string, number>;
  build?: BodyBuild;
  heightTendency?: HeightTendency;
  /** Seed для индивидуального темпа (имя, seed семьи). */
  seed: string;
  /** Текущая минута кампании; вехи, которые уже должны были пройти, отмечаются сразу. */
  nowMinute: number;
}

export const NEUTRAL_TEMPERAMENT: Temperament = { activity: 50, sensitivity: 50, approach: 50, adaptability: 50, intensity: 50, mood: 50 };

export const TEMPERAMENT_LABELS: Record<keyof Temperament, [string, string, string]> = {
  activity: ["Подвижность", "спокойный", "непоседливый"],
  sensitivity: ["Чувствительность", "невозмутимый", "очень чувствительный"],
  approach: ["Отношение к новому", "осторожный, держится в стороне", "тянется к людям и новому"],
  adaptability: ["Приспособляемость", "тяжело привыкает к переменам", "легко привыкает"],
  intensity: ["Сила реакций", "реагирует тихо", "реагирует бурно"],
  mood: ["Настроение", "чаще хмурый и тревожный", "чаще светлый"]
};

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return hash >>> 0;
}
/** Детерминированное число 0..1 из строки: одна и та же анкета всегда даёт тот же темп. */
const seeded = (seed: string) => (stableHash(seed) % 10000) / 10000;

const apt = (aptitudes: Record<string, number>, key: string) => clamp(aptitudes[key] ?? 15, 1, 30);
/** Задаток 15: средний темп; 30: примерно на 18% быстрее, 1: на 18% медленнее. */
const aptitudeFactor = (value: number) => 1 + (value - 15) * 0.012;

export function computePace(aptitudes: Record<string, number>, temperament: Temperament, seed: string): Record<DevelopmentDomain, number> {
  const jitter = (domain: string) => 0.9 + seeded(`${seed}:${domain}`) * 0.2;
  return {
    motor: round2(aptitudeFactor((apt(aptitudes, "Ловкость") + apt(aptitudes, "Сила") + apt(aptitudes, "Выносливость")) / 3) * (0.95 + temperament.activity / 1000) * jitter("motor")),
    language: round2(aptitudeFactor((apt(aptitudes, "Интеллект") + apt(aptitudes, "Харизма")) / 2) * jitter("language")),
    social: round2(aptitudeFactor((apt(aptitudes, "Харизма") + apt(aptitudes, "Восприятие")) / 2) * (0.95 + temperament.approach / 1000) * jitter("social")),
    cognitive: round2(aptitudeFactor((apt(aptitudes, "Интеллект") + apt(aptitudes, "Восприятие") + apt(aptitudes, "Воля")) / 3) * jitter("cognitive"))
  };
}
function round2(value: number) { return Math.round(value * 100) / 100; }

/** Базовый характер выводится из темперамента; дальше он меняется только опытом. */
export function traitsFromTemperament(t: Temperament): PersonalityTraits {
  return {
    warmth: Math.round(clamp(35 + t.mood * 0.3 + t.approach * 0.1)),
    sociability: Math.round(clamp(20 + t.approach * 0.6)),
    assertiveness: Math.round(clamp(20 + t.activity * 0.3 + t.intensity * 0.3)),
    emotionalReactivity: Math.round(clamp(10 + t.intensity * 0.5 + t.sensitivity * 0.3)),
    patience: Math.round(clamp(25 + t.adaptability * 0.4 + (100 - t.activity) * 0.2)),
    openness: Math.round(clamp(20 + t.approach * 0.3 + t.adaptability * 0.3)),
    discipline: 40,
    suspicion: Math.round(clamp(70 - t.approach * 0.4)),
    empathy: Math.round(clamp(30 + t.sensitivity * 0.4)),
    pride: 45
  };
}

// --- физический рост --------------------------------------------------------

/** Опорные точки медианного роста (см) по месяцам; условная игровая модель, не медицинская норма. */
const HEIGHT_CURVE: Array<[number, number, number]> = [
  // [месяц, мальчик, девочка]
  [0, 50, 49], [3, 61, 60], [6, 67, 65], [12, 76, 74], [24, 87, 86], [36, 96, 95], [60, 110, 109],
  [96, 128, 127], [144, 150, 151], [168, 165, 159], [192, 173, 163], [216, 177, 164], [900, 177, 164]
];
const BMI_CURVE: Array<[number, number]> = [[0, 13.4], [6, 17.3], [12, 17], [24, 16.2], [60, 15.3], [120, 16.6], [168, 19.5], [216, 21.8], [900, 23]];

function interpolate(curve: Array<number[]>, x: number, column: number): number {
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1]!, b = curve[i]!;
    if (x <= b[0]!) {
      const k = (x - a[0]!) / (b[0]! - a[0]!);
      return a[column]! + (b[column]! - a[column]!) * k;
    }
  }
  return curve[curve.length - 1]![column]!;
}

export function expectedHeightCm(months: number, sex: DevelopmentState["sex"], tendency: HeightTendency): number {
  const boy = interpolate(HEIGHT_CURVE, months, 1), girl = interpolate(HEIGHT_CURVE, months, 2);
  const median = sex === "male" ? boy : sex === "female" ? girl : (boy + girl) / 2;
  const offset = tendency === "short" ? -0.05 : tendency === "tall" ? 0.05 : 0;
  return median * (1 + offset);
}
export function expectedWeightKg(months: number, heightCm: number, build: BodyBuild): number {
  const bmi = interpolate(BMI_CURVE, months, 1) * (build === "slender" ? 0.9 : build === "sturdy" ? 1.1 : 1);
  return bmi * (heightCm / 100) ** 2;
}

// --- возраст -----------------------------------------------------------------

export function ageDays(dev: Pick<DevelopmentState, "birthMinute">, minute: number): number {
  return Math.max(0, Math.floor((minute - dev.birthMinute) / MINUTES_PER_DAY));
}
export function ageMonths(dev: Pick<DevelopmentState, "birthMinute">, minute: number): number {
  return Math.max(0, (minute - dev.birthMinute) / MINUTES_PER_DAY / DAYS_PER_MONTH);
}
export function ageYears(dev: Pick<DevelopmentState, "birthMinute">, minute: number): number {
  return Math.floor(Math.max(0, minute - dev.birthMinute) / MINUTES_PER_YEAR);
}
export function formatAge(dev: Pick<DevelopmentState, "birthMinute">, minute: number): string {
  const days = ageDays(dev, minute);
  if (days < 31) return days === 0 ? "новорождённый" : `${days} ${plural(days, "день", "дня", "дней")}`;
  const months = Math.floor(ageMonths(dev, minute));
  if (months < 24) return `${months} ${plural(months, "месяц", "месяца", "месяцев")}`;
  const years = ageYears(dev, minute);
  const rest = Math.floor(months - years * 12);
  return years < 6 && rest > 0 ? `${years} ${plural(years, "год", "года", "лет")} ${rest} мес` : `${years} ${plural(years, "год", "года", "лет")}`;
}
function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export function createDevelopment(setup: DevelopmentSetup): DevelopmentState {
  const temperament = { ...NEUTRAL_TEMPERAMENT, ...(setup.temperament ?? {}) };
  for (const key of Object.keys(temperament) as Array<keyof Temperament>) temperament[key] = Math.round(clamp(temperament[key]));
  const sex = setup.sex ?? "unspecified";
  const build = setup.build ?? "average";
  const heightTendency = setup.heightTendency ?? "average";
  const months = Math.max(0, (setup.nowMinute - setup.birthMinute) / MINUTES_PER_DAY / DAYS_PER_MONTH);
  const pace = computePace(setup.aptitudes, temperament, setup.seed);
  const heightCm = round1(expectedHeightCm(months, sex, heightTendency));
  const dev: DevelopmentState = {
    version: 1,
    birthMinute: setup.birthMinute,
    lastProcessedMinute: setup.nowMinute,
    sex, temperament,
    aptitudes: { ...setup.aptitudes },
    pace,
    developmentalMonths: { motor: months * pace.motor, language: months * pace.language, social: months * pace.social, cognitive: months * pace.cognitive },
    milestones: {},
    physical: { heightCm, weightKg: round1(expectedWeightKg(months, heightCm, build)), build, heightTendency, health: 90, nutrition: 80, growthDeficitCm: 0 },
    needs: { hunger: 20, tiredness: 10, distress: months < 0.1 ? 40 : 10 },
    lastFedMinute: setup.nowMinute,
    lastSleptMinute: setup.nowMinute,
    attachments: {},
    experiences: [],
    traits: traitsFromTemperament(temperament),
    pendingInfluence: {},
    habits: []
  };
  // Персонаж, начинающий не с рождения, уже прошёл свои вехи; дата их наступления не выдумывается.
  for (const milestone of MILESTONES) if (dev.developmentalMonths[milestone.domain] >= milestone.typicalMonths) dev.milestones[milestone.id] = setup.birthMinute;
  if (months >= 48) dev.milestones["lasting-memories"] = setup.birthMinute;
  return dev;
}

export const hasMilestone = (dev: DevelopmentState | undefined, id: MilestoneId): boolean => dev ? dev.milestones[id] !== undefined : true;

// ---------------------------------------------------------------------------
// Возможности по возрасту
// ---------------------------------------------------------------------------

export interface Capabilities {
  stage: LifeStageDef;
  /** Максимум слов в реплике; 0: речи нет, Infinity: без ограничений. */
  maxWordsPerUtterance: number;
  canWalk: boolean;
  /** Максимальная длина перехода, который ребёнок может пройти сам (метры). */
  maxUnaccompaniedExitM: number;
  canTrade: boolean;
  canCrawl: boolean;
  infantActions: InfantActId[];
}

export type InfantActId = "cry" | "sleep" | "feed" | "smile" | "watch" | "reach" | "cling" | "babble" | "play";

export const INFANT_ACT_LABELS: Record<InfantActId, string> = {
  cry: "плакать", sleep: "спать", feed: "просить грудь", smile: "улыбнуться", watch: "смотреть вокруг",
  reach: "тянуться к человеку", cling: "прижаться к близкому", babble: "лепетать", play: "играть с предметом"
};

export function capabilities(dev: DevelopmentState | undefined, minute: number): Capabilities {
  if (!dev) return { stage: LIFE_STAGES[5]!, maxWordsPerUtterance: Infinity, canWalk: true, maxUnaccompaniedExitM: Infinity, canTrade: true, canCrawl: true, infantActions: [] };
  const months = ageMonths(dev, minute);
  const stage = lifeStageForMonths(months);
  const words = hasMilestone(dev, "fluent-speech") ? Infinity
    : hasMilestone(dev, "simple-sentences") ? 6
    : hasMilestone(dev, "two-word-phrases") ? 3
    : hasMilestone(dev, "first-word") ? 1 : 0;
  const canWalk = hasMilestone(dev, "walks-steadily");
  const years = months / 12;
  const maxUnaccompaniedExitM = !canWalk ? 0 : years < 3 ? 30 : years < 6 ? 100 : years < 10 ? 600 : Infinity;
  const infantActions: InfantActId[] = ["cry", "sleep", "watch"];
  if (months < 30) infantActions.push("feed");
  if (hasMilestone(dev, "social-smile")) infantActions.push("smile");
  if (hasMilestone(dev, "knows-faces")) infantActions.push("reach", "cling");
  if (!hasMilestone(dev, "fluent-speech") && months >= 4) infantActions.push("babble");
  if (hasMilestone(dev, "sits")) infantActions.push("play");
  return {
    stage, maxWordsPerUtterance: words, canWalk, maxUnaccompaniedExitM,
    canTrade: years >= 10, canCrawl: hasMilestone(dev, "crawls"),
    infantActions: stage.id === "infancy" || stage.id === "early-childhood" ? infantActions : []
  };
}

// ---------------------------------------------------------------------------
// Уход и окружение
// ---------------------------------------------------------------------------

export interface CaregiverView { id: string; name: string; canFeed: boolean; warmth: number }

/** Кто из присутствующих может заботиться о ребёнке, и с какой теплотой. */
export function presentCaregivers(world: WorldData, state: GameState, minute = state.minute): CaregiverView[] {
  if (state.journey) return [];
  return npcsAt(world, minute, state.playerLocation, state.npcDeaths).flatMap(id => {
    const npc = world.npcs[id]!;
    if (!npc.caregiving) return [];
    const relation = state.relations[id];
    const base = npc.personality?.traits.warmth ?? 50;
    // Тепло к конкретному ребёнку = характер человека + его личное отношение к ребёнку.
    const warmth = clamp(base * 0.5 + 25 + (relation ? relation.sympathy * 0.4 : 0));
    return [{ id, name: npc.name, canFeed: npc.caregiving.canFeed, warmth }];
  });
}

function touchAttachment(dev: DevelopmentState, npcId: string, minute: number, security: number, familiarity: number, wariness: number): void {
  const current = dev.attachments[npcId] ?? { security: 10, familiarity: 0, wariness: 0, lastContactMinute: minute };
  if (current.lost) return;
  // Рост замедляется у верхней границы: доверие копится годами, а не за неделю.
  const toward = (value: number, delta: number) => delta >= 0 ? value + delta * (1 - value / 100) : value + delta;
  dev.attachments[npcId] = {
    ...current,
    security: round1(clamp(toward(current.security, security))),
    familiarity: round1(clamp(toward(current.familiarity, familiarity))),
    wariness: round1(clamp(toward(current.wariness, wariness))),
    lastContactMinute: minute
  };
}

function addInfluence(dev: DevelopmentState, influence: Partial<Record<keyof PersonalityTraits, number>>, scale = 1): void {
  for (const [key, value] of Object.entries(influence) as Array<[keyof PersonalityTraits, number]>) {
    dev.pendingInfluence[key] = round1(clamp((dev.pendingInfluence[key] ?? 0) + value * scale, -60, 60));
  }
}

/** Пластичность характера: высокая в детстве, низкая во взрослом возрасте. */
export function plasticity(months: number): number {
  if (months < 72) return 1;
  if (months < 144) return 0.8;
  if (months < 216) return 0.55;
  if (months < 360) return 0.3;
  return 0.15;
}

function reinforceHabit(dev: DevelopmentState, habit: { id: string; label: string; trigger: string; context?: string }, minute: number, step = 3): void {
  const existing = dev.habits.find(h => h.id === habit.id);
  if (existing) {
    existing.strength = Math.round(clamp(existing.strength + step));
    existing.repetitions += 1;
    existing.lastReinforcedMinute = minute;
  } else {
    dev.habits.push({ ...habit, strength: 12, repetitions: 1, lastReinforcedMinute: minute });
  }
}

export function recordExperience(dev: DevelopmentState, minute: number, text: string, tag: string, weight: number, influence: Partial<Record<keyof PersonalityTraits, number>> = {}): void {
  dev.experiences = [...dev.experiences, { minute, text, tag, weight, preverbal: !hasMilestone(dev, "lasting-memories") }].slice(-120);
  addInfluence(dev, influence, weight);
}

// ---------------------------------------------------------------------------
// Ежечасная и ежедневная симуляция
// ---------------------------------------------------------------------------

export interface DevelopmentNotice { minute: number; text: string; important: boolean }

function cloneDev(dev: DevelopmentState): DevelopmentState {
  return {
    ...dev,
    aptitudes: { ...dev.aptitudes }, pace: { ...dev.pace }, developmentalMonths: { ...dev.developmentalMonths },
    milestones: { ...dev.milestones }, physical: { ...dev.physical }, needs: { ...dev.needs },
    attachments: Object.fromEntries(Object.entries(dev.attachments).map(([id, a]) => [id, { ...a }])),
    experiences: [...dev.experiences], traits: { ...dev.traits }, pendingInfluence: { ...dev.pendingInfluence },
    habits: dev.habits.map(h => ({ ...h }))
  };
}

/** Насколько часто ребёнку нужно есть: новорождённому каждые ~3 часа, к году реже. */
const hungerPerHour = (months: number) => months < 3 ? 30 : months < 12 ? 20 : months < 36 ? 12 : 8;
const tirednessPerHour = (months: number) => months < 3 ? 16 : months < 12 ? 11 : months < 36 ? 8 : 6;

/**
 * Один час жизни ребёнка: голод, усталость, уход, привязанность.
 * Возвращает уведомления, которые нужно показать игроку.
 */
function simulateHour(world: WorldData, state: GameState, dev: DevelopmentState, minute: number, notices: DevelopmentNotice[]): void {
  const months = ageMonths(dev, minute);
  const hour = Math.floor((minute % MINUTES_PER_DAY) / 60);
  const night = hour >= 21 || hour < 6;
  // Присутствие оценивается в середине часа: короткие визиты (например, утренний обход) тоже учитываются.
  const caregivers = presentCaregivers(world, { ...state, minute: minute - 30 }, minute - 30);
  const young = months < 72;

  dev.needs.hunger = clamp(dev.needs.hunger + hungerPerHour(months));
  dev.needs.tiredness = clamp(dev.needs.tiredness + tirednessPerHour(months) * (night ? 1.5 : 1));

  // Сон: ночью и при усталости ребёнок засыпает сам, если ему спокойно.
  if (dev.needs.tiredness >= 60 && dev.needs.distress < 70) {
    dev.needs.tiredness = clamp(dev.needs.tiredness - 45);
    dev.lastSleptMinute = minute;
  }

  // Кормление: младенца кормит тот, кто может (мать, кормилица); старших детей кормят домашние.
  if (dev.needs.hunger >= 55) {
    const feeder = caregivers.filter(c => c.canFeed || months >= 12).sort((a, b) => b.warmth - a.warmth)[0];
    if (feeder) {
      dev.needs.hunger = clamp(dev.needs.hunger - 70);
      dev.lastFedMinute = minute;
      dev.physical.nutrition = clamp(dev.physical.nutrition + 6);
      if (young) touchAttachment(dev, feeder.id, minute, feeder.warmth >= 55 ? 0.6 : 0.1, 0.4, feeder.warmth < 30 ? 0.3 : 0);
    } else if (months < 48) {
      dev.needs.distress = clamp(dev.needs.distress + 12);
      dev.physical.nutrition = clamp(dev.physical.nutrition - 2);
    }
  }

  // Присутствие людей: тёплые успокаивают, холодные настораживают. Младенец чувствует интонацию, а не слова.
  if (young) {
    for (const caregiver of caregivers) {
      const warm = caregiver.warmth >= 55, cold = caregiver.warmth < 30;
      touchAttachment(dev, caregiver.id, minute, warm ? 0.12 : 0.02, 0.1, cold ? 0.12 * (0.5 + dev.temperament.sensitivity / 100) : 0);
    }
    const comforting = caregivers.filter(c => c.warmth >= 45);
    if (comforting.length) dev.needs.distress = clamp(dev.needs.distress - 15 - comforting.length * 3);
    else dev.needs.distress = clamp(dev.needs.distress + (night ? 1 : 3));

    // После вехи «настороженность к чужим» ребёнок замечает отсутствие тех, к кому привязан.
    if (hasMilestone(dev, "stranger-wariness") && !night) {
      const presentIds = new Set(caregivers.map(c => c.id));
      const missed = Object.entries(dev.attachments).filter(([id, a]) => !a.lost && a.security >= 40 && !presentIds.has(id) && minute - a.lastContactMinute > 12 * 60);
      if (missed.length && comforting.length === 0) dev.needs.distress = clamp(dev.needs.distress + 6);
    }
  } else {
    dev.needs.distress = clamp(dev.needs.distress - 10);
  }

  if (dev.needs.distress >= 85 && young) {
    const last = dev.experiences[dev.experiences.length - 1];
    if (!last || last.tag !== "unanswered-distress" || minute - last.minute > 3 * MINUTES_PER_DAY) {
      recordExperience(dev, minute, "Долго плакал, и никто не пришёл утешить.", "unanswered-distress", 0.6, { suspicion: 2, warmth: -1, emotionalReactivity: 1 });
      notices.push({ minute, text: "Ребёнок долго плачет: рядом нет никого, кто бы успокоил.", important: false });
    }
  }
}

/** Один полный день: рост, темп развития, вехи, постепенное формирование характера и привычек. */
function simulateDay(world: WorldData, state: GameState, dev: DevelopmentState, dayEndMinute: number, notices: DevelopmentNotice[]): void {
  const months = ageMonths(dev, dayEndMinute);
  const nutritionFactor = 0.6 + dev.physical.nutrition / 250; // 0.6..1.0
  const healthFactor = 0.7 + dev.physical.health / 333;        // 0.7..1.0
  const securityValues = Object.values(dev.attachments).filter(a => !a.lost).map(a => a.security);
  const bestSecurity = securityValues.length ? Math.max(...securityValues) : 0;
  const careFactor = 0.85 + Math.min(0.25, bestSecurity / 300);
  const talkers = Object.values(dev.attachments).filter(a => !a.lost && a.familiarity >= 30).length;
  const languageFactor = 0.85 + Math.min(0.3, talkers * 0.08);
  const dayMonths = 1 / DAYS_PER_MONTH;

  const gain: Record<DevelopmentDomain, number> = {
    motor: dev.pace.motor * nutritionFactor * healthFactor,
    language: dev.pace.language * languageFactor * healthFactor,
    social: dev.pace.social * careFactor,
    cognitive: dev.pace.cognitive * healthFactor * (0.9 + Math.min(0.2, talkers * 0.05))
  };
  for (const domain of Object.keys(gain) as DevelopmentDomain[]) dev.developmentalMonths[domain] += gain[domain] * dayMonths;

  for (const milestone of MILESTONES) {
    if (dev.milestones[milestone.id] !== undefined) continue;
    if (dev.developmentalMonths[milestone.domain] < milestone.typicalMonths) continue;
    // Часть вех требует предыдущих: шаги без сидения, фразы без первого слова не появляются.
    if (milestone.id === "first-steps" && !hasMilestone(dev, "sits")) continue;
    if (milestone.id === "walks-steadily" && !hasMilestone(dev, "first-steps")) continue;
    if (milestone.id === "two-word-phrases" && !hasMilestone(dev, "first-word")) continue;
    if (milestone.id === "simple-sentences" && !hasMilestone(dev, "two-word-phrases")) continue;
    if (milestone.id === "fluent-speech" && !hasMilestone(dev, "simple-sentences")) continue;
    dev.milestones[milestone.id] = dayEndMinute;
    notices.push({ minute: dayEndMinute, text: `Новая веха развития: ${milestone.label.toLocaleLowerCase("ru-RU")} (${formatAge(dev, dayEndMinute)}). Теперь ${milestone.unlocks}.`, important: true });
  }

  // Физический рост: дефицит питания и болезни замедляют рост; частично догоняется при хорошем уходе.
  const target = expectedHeightCm(months, dev.sex, dev.physical.heightTendency);
  const deficitGain = dev.physical.nutrition < 45 ? (45 - dev.physical.nutrition) / 45 * 0.01 : -0.004;
  dev.physical.growthDeficitCm = round1(clamp(dev.physical.growthDeficitCm + (months < 216 ? deficitGain : 0), 0, 15));
  dev.physical.heightCm = round1(Math.max(dev.physical.heightCm, target - dev.physical.growthDeficitCm));
  const weightTarget = expectedWeightKg(months, dev.physical.heightCm, dev.physical.build) * (0.85 + dev.physical.nutrition / 666);
  dev.physical.weightKg = round1(dev.physical.weightKg + (weightTarget - dev.physical.weightKg) * 0.08);
  dev.physical.nutrition = clamp(dev.physical.nutrition - 1);
  dev.physical.health = clamp(dev.physical.health + (dev.physical.nutrition >= 50 ? 0.3 : -0.4) - (dev.needs.distress >= 80 ? 0.3 : 0));

  // Контекстные привычки и привязанности формируются повторением.
  if (months < 72) {
    for (const [npcId, attachment] of Object.entries(dev.attachments)) {
      if (attachment.lost) continue;
      const name = world.npcs[npcId]?.name ?? npcId;
      if (attachment.wariness >= 25 && attachment.wariness > attachment.security) {
        reinforceHabit(dev, { id: `guarded-near-${npcId}`, label: `затихает и настораживается рядом с: ${name}`, trigger: `присутствие:${npcId}`, context: `присутствие:${npcId}` }, dayEndMinute, 1);
        if (months < 36) addInfluence(dev, { suspicion: 0.05, emotionalReactivity: 0.02 }, 1);
      }
      if (attachment.security >= 50 && hasMilestone(dev, "knows-faces")) {
        reinforceHabit(dev, { id: `seeks-${npcId}`, label: `ищет взглядом и тянется к: ${name}`, trigger: `тревога или усталость`, context: `присутствие:${npcId}` }, dayEndMinute, 1);
        if (months < 36) addInfluence(dev, { warmth: 0.03, suspicion: -0.02 }, 1);
      }
    }
  }
  // Старшие дети: отношения с домашними поддерживаются ежедневными встречами (утро и вечер).
  if (months >= 72) {
    const dayStart = dayEndMinute - MINUTES_PER_DAY;
    for (const sample of [dayStart + 9 * 60 + 30, dayStart + 19 * 60 + 30]) {
      for (const c of presentCaregivers(world, { ...state, minute: sample }, sample)) {
        touchAttachment(dev, c.id, sample, c.warmth >= 55 ? 0.3 : 0, 0.1, c.warmth < 30 ? 0.15 : 0);
      }
    }
  }
  // Без встреч привязанность медленно слабеет (но память о человеке остаётся в знакомстве).
  for (const attachment of Object.values(dev.attachments)) {
    if (!attachment.lost && dayEndMinute - attachment.lastContactMinute > 2 * MINUTES_PER_DAY) attachment.security = round1(clamp(attachment.security - 0.05));
  }
  // Привычки без подкрепления ослабевают и могут исчезнуть.
  dev.habits = dev.habits
    .map(h => dayEndMinute - h.lastReinforcedMinute > 7 * MINUTES_PER_DAY ? { ...h, strength: h.strength - 1 } : h)
    .filter(h => h.strength > 0)
    .slice(-16);

  // Постепенное усвоение опыта: не больше 0.15 пункта черты в день, с учётом возраста.
  const step = 0.15 * plasticity(months);
  for (const key of Object.keys(dev.pendingInfluence) as Array<keyof PersonalityTraits>) {
    const pending = dev.pendingInfluence[key] ?? 0;
    if (Math.abs(pending) < 0.01) { delete dev.pendingInfluence[key]; continue; }
    // Чем ближе черта к краю шкалы, тем медленнее она сдвигается дальше: характер не уходит в крайности от рутины.
    const room = pending > 0 ? (100 - dev.traits[key]) / 50 : dev.traits[key] / 50;
    const applied = Math.sign(pending) * Math.min(Math.abs(pending), step * Math.min(1, room));
    dev.traits[key] = round1(clamp(dev.traits[key] + applied));
    dev.pendingInfluence[key] = round1(pending - applied);
  }
}

/**
 * Продвигает развитие от lastProcessedMinute до targetMinute.
 * Час за часом считаются потребности (только в первые шесть лет), день за днём: рост и вехи.
 */
export function advanceDevelopment(world: WorldData, state: GameState, targetMinute: number): { development: DevelopmentState; notices: DevelopmentNotice[] } | null {
  const source = state.development;
  if (!source || state.lifeStatus === "dead" || targetMinute <= source.lastProcessedMinute) return null;
  const dev = cloneDev(source);
  const notices: DevelopmentNotice[] = [];
  let cursor = dev.lastProcessedMinute;
  const hourly = ageMonths(dev, cursor) < 72;
  while (cursor < targetMinute) {
    const nextHour = Math.min(targetMinute, (Math.floor(cursor / 60) + 1) * 60);
    if (hourly && nextHour % 60 === 0) simulateHour(world, state, dev, nextHour, notices);
    if (nextHour % MINUTES_PER_DAY === 0) simulateDay(world, state, dev, nextHour, notices);
    cursor = nextHour;
  }
  dev.lastProcessedMinute = targetMinute;
  return { development: dev, notices };
}

// ---------------------------------------------------------------------------
// Действия младенца и ребёнка
// ---------------------------------------------------------------------------

export interface InfantActResult { ok: boolean; development?: DevelopmentState; minutes: number; text: string; eventText?: string; relationDeltas?: Record<string, { sympathy?: number; trust?: number }> }

/** Применяет невербальное действие ребёнка. Не двигает время: это делает rules.ts. */
export function performInfantAct(world: WorldData, state: GameState, act: InfantActId): InfantActResult {
  const dev = state.development;
  if (!dev) return { ok: false, minutes: 0, text: "У персонажа нет данных о развитии." };
  const caps = capabilities(dev, state.minute);
  if (!caps.infantActions.includes(act)) return { ok: false, minutes: 0, text: `Сейчас это недоступно: «${INFANT_ACT_LABELS[act]}» ещё не по возрасту или уже не свойственно этому этапу.` };
  const next = cloneDev(dev);
  const caregivers = presentCaregivers(world, state);
  const warm = caregivers.filter(c => c.warmth >= 45);
  const names = (list: CaregiverView[]) => list.map(c => c.name).join(", ");
  const minute = state.minute;
  switch (act) {
    case "cry": {
      if (warm.length) {
        warm.sort((a, b) => b.warmth - a.warmth);
        next.needs.distress = clamp(next.needs.distress - 35);
        for (const c of warm) touchAttachment(next, c.id, minute, 1.2, 0.5, 0);
        const cold = caregivers.filter(c => c.warmth < 30);
        for (const c of cold) touchAttachment(next, c.id, minute, 0, 0.2, 0.6);
        reinforceHabit(next, { id: "cries-for-comfort", label: "зовёт плачем, когда тревожно", trigger: "тревога" }, minute, 2);
        return { ok: true, development: next, minutes: 10, text: `Вы плачете. К вам подходит ${warm[0]!.name}: берёт на руки, покачивает, и плач стихает.`, eventText: `Младенец плачет; ${names(warm)} успокаивает его.` };
      }
      next.needs.distress = clamp(next.needs.distress + 10);
      if (caregivers.length) for (const c of caregivers) touchAttachment(next, c.id, minute, 0, 0.2, 0.8);
      recordExperience(next, minute, caregivers.length ? `Плакал, но ${names(caregivers)} не стал(а) утешать.` : "Плакал в пустой комнате.", "unanswered-cry", 0.3, { suspicion: 1 });
      return { ok: true, development: next, minutes: 10, text: caregivers.length ? `Вы плачете. ${names(caregivers)} рядом, но не берёт вас на руки.` : "Вы плачете, но рядом никого нет.", eventText: "Младенец плачет." };
    }
    case "sleep": {
      if (next.needs.tiredness < 25) return { ok: false, minutes: 0, text: "Вы не хотите спать: глаза открыты, вокруг слишком интересно." };
      next.needs.tiredness = 0; next.lastSleptMinute = minute;
      next.needs.distress = clamp(next.needs.distress - 20);
      const hours = ageMonths(dev, minute) < 6 ? 2 : 1;
      return { ok: true, development: next, minutes: hours * 60, text: `Вы засыпаете и спите около ${hours} ч.` };
    }
    case "feed": {
      const feeder = caregivers.filter(c => c.canFeed).sort((a, b) => b.warmth - a.warmth)[0];
      if (!feeder) return { ok: false, minutes: 0, text: "Рядом нет никого, кто может вас покормить. Остаётся только плакать." };
      if (next.needs.hunger < 25) return { ok: false, minutes: 0, text: "Вы сыты и отворачиваетесь." };
      next.needs.hunger = 0; next.lastFedMinute = minute;
      next.physical.nutrition = clamp(next.physical.nutrition + 8);
      touchAttachment(next, feeder.id, minute, feeder.warmth >= 55 ? 1.5 : 0.3, 1, 0);
      return { ok: true, development: next, minutes: 25, text: `${feeder.name} кормит вас. Становится тепло и спокойно.`, eventText: `${feeder.name} кормит младенца.` };
    }
    case "smile": {
      if (!caregivers.length) return { ok: true, development: next, minutes: 1, text: "Вы улыбаетесь, но никто этого не видит." };
      const deltas: Record<string, { sympathy: number }> = {};
      for (const c of caregivers) {
        // Улыбка тёплого взрослого радует; холодного может слегка смягчить, но не переписать отношение.
        deltas[c.id] = { sympathy: c.warmth >= 45 ? 3 : 1 };
        touchAttachment(next, c.id, minute, 0.5, 0.3, 0);
      }
      reinforceHabit(next, { id: "smiles-at-familiar", label: "улыбается знакомым лицам", trigger: "знакомое лицо" }, minute, 2);
      addInfluence(next, { warmth: 0.3, sociability: 0.2 });
      return { ok: true, development: next, minutes: 1, text: `Вы улыбаетесь. ${names(caregivers)} замечает улыбку.`, eventText: "Младенец улыбается.", relationDeltas: deltas };
    }
    case "watch": {
      const present = npcsAt(world, minute, state.playerLocation, state.npcDeaths);
      for (const id of present) touchAttachment(next, id, minute, 0, 0.6, 0);
      addInfluence(next, { openness: 0.2 });
      const who = present.map(id => world.npcs[id]?.name ?? id);
      return { ok: true, development: next, minutes: 15, text: who.length ? `Вы долго смотрите на лица и свет. Рядом: ${who.join(", ")}.` : "Вы смотрите на свет, тени и потолок. Рядом никого." };
    }
    case "reach":
    case "cling": {
      const target = [...caregivers].sort((a, b) => (next.attachments[b.id]?.security ?? 0) - (next.attachments[a.id]?.security ?? 0))[0];
      if (!target) return { ok: false, minutes: 0, text: "Рядом нет никого, к кому можно потянуться." };
      const accepted = target.warmth >= 45;
      touchAttachment(next, target.id, minute, accepted ? 1.5 : 0, 0.5, accepted ? 0 : 1);
      next.needs.distress = clamp(next.needs.distress - (accepted ? 25 : 0));
      if (!accepted) recordExperience(next, minute, `Потянулся к ${target.name}, но не получил ответа.`, "rejected-reach", 0.4, { warmth: -1, suspicion: 1 });
      else reinforceHabit(next, { id: `seeks-${target.id}`, label: `ищет взглядом и тянется к: ${target.name}`, trigger: "тревога или усталость", context: `присутствие:${target.id}` }, minute, 3);
      return {
        ok: true, development: next, minutes: 5,
        text: accepted ? `Вы тянетесь к ${target.name}, и вас берут на руки.` : `Вы тянетесь к ${target.name}, но в ответ: только сдержанный взгляд.`,
        eventText: `Младенец тянется к ${target.name}.`,
        relationDeltas: accepted ? { [target.id]: { sympathy: 2 } } : {}
      };
    }
    case "babble": {
      const listeners = caregivers.filter(c => c.warmth >= 45);
      next.developmentalMonths.language += listeners.length ? 0.03 : 0.01;
      return { ok: true, development: next, minutes: 5, text: listeners.length ? `Вы лепечете, и ${listeners[0]!.name} отвечает вам, повторяя звуки.` : "Вы лепечете сами с собой." };
    }
    case "play": {
      next.developmentalMonths.motor += 0.02; next.developmentalMonths.cognitive += 0.02;
      reinforceHabit(next, { id: "explores-objects", label: "сосредоточенно изучает предметы", trigger: "новая вещь" }, minute, 2);
      addInfluence(next, { openness: 0.3, discipline: 0.1 });
      return { ok: true, development: next, minutes: 20, text: "Вы вертите в руках погремушку, тянете её в рот, бросаете и снова ищете взглядом." };
    }
  }
}

// ---------------------------------------------------------------------------
// Потери и события жизни
// ---------------------------------------------------------------------------

/** Смерть или исчезновение значимого человека. Влияние зависит от силы привязанности и возраста. */
export function applyLossOfAttachment(dev: DevelopmentState, npcId: string, npcName: string, minute: number): DevelopmentState {
  const next = cloneDev(dev);
  const attachment = next.attachments[npcId];
  if (!attachment || attachment.lost) return next;
  next.attachments[npcId] = { ...attachment, lost: true };
  const strength = attachment.security / 100;
  next.needs.distress = clamp(next.needs.distress + 30 + strength * 40);
  recordExperience(next, minute,
    hasMilestone(next, "lasting-memories")
      ? `${npcName} больше нет рядом. Эта потеря запомнится навсегда.`
      : `${npcName} исчезла из жизни ребёнка. Осознанного воспоминания не останется, но остаётся ощущение пустоты и тревоги.`,
    "loss-of-attachment", 0.5 + strength * 2,
    { suspicion: 3, warmth: -2, emotionalReactivity: 2, empathy: 1 });
  return next;
}

/** Текст памяти игрока с учётом того, может ли ребёнок вообще это запомнить. */
export function memoryFraming(dev: DevelopmentState | undefined, text: string): { text: string; confidence: number } {
  if (!dev || hasMilestone(dev, "lasting-memories")) return { text, confidence: 1 };
  return { text: `[До первых связных воспоминаний; персонаж не помнит этого сознательно] ${text}`, confidence: 0.2 };
}

// ---------------------------------------------------------------------------
// Миграция старых сохранений
// ---------------------------------------------------------------------------

/** Сохранение без системы развития получает её по возрасту анкеты. Прошедшие вехи считаются достигнутыми. */
export function ensureDevelopment(state: GameState): GameState {
  if (state.development || !state.playerProfile) return state;
  const profile = state.playerProfile;
  const birthMinute = state.minute - profile.age * MINUTES_PER_YEAR - (profile.ageProgressMinutes ?? 0);
  return {
    ...state,
    development: createDevelopment({
      birthMinute, nowMinute: state.minute, aptitudes: profile.attributes, seed: `${state.playerName}:${profile.originId}`,
      sex: profile.sex ?? "unspecified"
    })
  };
}

/** Подробное описание для ИИ и интерфейса. */
export function describeDevelopment(dev: DevelopmentState, minute: number, world?: WorldData): string {
  const caps = capabilities(dev, minute);
  const speech = caps.maxWordsPerUtterance === 0 ? "не говорит" : caps.maxWordsPerUtterance === Infinity ? "говорит свободно" : `говорит не больше ${caps.maxWordsPerUtterance} слов за раз`;
  const attachments = Object.entries(dev.attachments)
    .filter(([, a]) => a.familiarity >= 10 || a.lost)
    .sort(([, a], [, b]) => b.security - a.security).slice(0, 5)
    .map(([id, a]) => `${world?.npcs[id]?.name ?? id}: безопасность ${Math.round(a.security)}, настороженность ${Math.round(a.wariness)}${a.lost ? " (утрачен)" : ""}`);
  return [
    `Этап: ${caps.stage.label}, возраст ${formatAge(dev, minute)}`,
    `речь: ${speech}`, caps.canWalk ? "ходит" : caps.canCrawl ? "ползает, не ходит" : "не ходит, его носят на руках",
    `рост ${dev.physical.heightCm} см, вес ${dev.physical.weightKg} кг, здоровье ${Math.round(dev.physical.health)}/100`,
    attachments.length ? `привязанности: ${attachments.join("; ")}` : "устойчивых привязанностей ещё нет",
    hasMilestone(dev, "lasting-memories") ? "имеет связные воспоминания" : "связных воспоминаний ещё нет: ранние события не помнит сознательно"
  ].join("; ") + ".";
}

/** Удобный фильтр для NPC, которые участвуют в уходе. */
export const isCaregiver = (npc: NpcDef): boolean => Boolean(npc.caregiving);
