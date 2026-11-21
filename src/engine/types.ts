import type { AppearanceObservation, CharacterAppearanceState, ClothingCondition } from "./appearance";

/** Статические определения мира (не меняются во время игры). */
/** Тип местности влияет на скорость и проходимость (см. geography.ts). */
export type Terrain = "street" | "road" | "path" | "forest" | "mountain" | "swamp";
/** Путь между локациями: реальные данные: расстояние в метрах, а не «минуты». */
export interface Exit { to: string; distanceM: number; terrain: Terrain }
export interface Shop { keeperId: string; prices: Record<string, number> }
export interface LocationDef {
  id: string;
  name: string;
  description: string;
  exits: Exit[];
  shop?: Shop;
}
export interface ItemDef { id: string; name: string }
export interface ScheduleEntry { from: number; to: number; locationId: string; activity?: string }
export interface PersonalityTraits {
  warmth: number;
  sociability: number;
  assertiveness: number;
  emotionalReactivity: number;
  patience: number;
  openness: number;
  discipline: number;
  suspicion: number;
  empathy: number;
  pride: number;
}
export interface NpcPersonality {
  /** Stable baseline; values are 0..100 and are not rewritten by short-term events. */
  temperament: string;
  traits: PersonalityTraits;
  values: string[];
  formativeExperiences: string[];
  copingPatterns: string[];
  initialHabits: Array<{ id: string; label: string; trigger: string; strength: number }>;
}
export interface NpcHabit {
  id: string;
  label: string;
  trigger: string;
  strength: number;
  repetitions: number;
  lastReinforcedMinute: number;
  /** Контекст, в котором привычка проявляется: «присутствие:<id>», «опасность», «одиночество»… */
  context?: string;
}
export interface NpcPsychology {
  habits: NpcHabit[];
  stress: number;
  emotionalLoad: number;
  lastSimulationMinute: number;
}
export interface NpcBond {
  familiarity: number;
  trust: number;
  warmth: number;
  tension: number;
  sharedEncounters: number;
  lastEncounterMinute: number;
}

export interface NpcDef {
  id: string;
  name: string;
  homeId: string;
  /** Биографические поля для сгенерированных родственников и других возрастных NPC. */
  age?: number;
  birthYear?: number;
  lifeStatus?: "alive" | "dead" | "missing";
  familyRole?: "biological-parent" | "guardian" | "other";
  /** Собственные цели NPC (он знает их о себе; игрок: нет). */
  goals: string[];
  /** Authored personality; if absent, a stable role-based profile is derived from NPC id. */
  personality?: NpcPersonality;
  schedule: ScheduleEntry[];
  /** Социальная роль важна для реакции на публичные заявления и правонарушения. */
  roleTags?: Array<"guard" | "clergy" | "healer" | "noble" | "merchant" | "commoner">;
  /** Откуда NPC родом (id страны/региона мира). Нужен, чтобы приезжие отличались от местных. */
  originStateId?: string;
  /** Устойчивая внешность NPC; текущие изменения хранятся в GameState.npcAppearances. */
  appearance?: CharacterAppearanceState;
  /** Абсолютная минута рождения в шкале кампании. До неё NPC не существует в мире. */
  bornAtMinute?: number;
  /** Расписания по возрасту: младенец, ребёнок и взрослый живут по-разному. */
  lifeSchedules?: Array<{ fromAgeYears: number; schedule: ScheduleEntry[] }>;
  /** Участвует ли NPC в уходе за ребёнком-игроком. */
  caregiving?: { role: "mother" | "father" | "wet-nurse" | "nanny" | "relative" | "guardian" | "teacher"; canFeed: boolean };
}
/** Запланированное событие мира (канон или проектная хронология), обрабатывается один раз. */
export interface ScheduledWorldEvent {
  id: string;
  minute: number;
  locationId: string;
  text: string;
  /** Отмечает смерть NPC в эту минуту. */
  npcDeathId?: string;
  /** Отмечает рождение NPC (сам NPC уже описан с bornAtMinute). */
  npcBirthId?: string;
  /** Пометка происхождения: канон или проектное допущение (например, точный день). */
  provenance: "canon" | "canon-date-assumed" | "proposal";
}
export interface WorldData {
  name: string;
  startLocationId: string;
  /** Глобальная точка на карте мира, если мир использует карту поселений. */
  globalStartId?: string;
  startMoney: number;
  startInventory: Record<string, number>;
  locations: Record<string, LocationDef>;
  items: Record<string, ItemDef>;
  npcs: Record<string, NpcDef>;
  /** Календарный год, соответствующий минуте 0 этого мира. */
  startYearKL?: number;
  scheduledEvents?: ScheduledWorldEvent[];
}

/**
 * Раздельные хранилища памяти.
 * own: личный опыт игрока; witnessed: NPC видел сам; heard: слух (мнение с уверенностью < 1).
 */
export type MemoryKind = "own" | "witnessed" | "heard";
export interface MemoryEntry {
  minute: number;
  text: string;
  kind: MemoryKind;
  /** 0..1. У очевидца 1, у слуха падает при каждой передаче. */
  confidence: number;
  /** Событие хроники, к которому относится запись. */
  eventId?: string;
  /** От кого услышан слух (id NPC). */
  source?: string;
}

/** Кто породил событие. */
export interface EventSource { kind: "player" | "npc" | "system"; id?: string }

export interface GameEvent {
  id: string;
  minute: number;
  locationId: string;
  text: string;
  witnesses: string[];
  source: EventSource;
  /** Фоновая бытовая запись (встреча NPC между собой): не попадает в контекст сцены. */
  routine?: true;
}
/** Хроника хранит объективные события мира. */
export type ChronicleEntry = GameEvent;

/** Отношение NPC к игроку: четыре независимых параметра, каждый −100..100. */
export interface Relation { trust: number; sympathy: number; fear: number; respect: number }

/** Динамическое состояние: единственный источник истины. */
export interface GameState {
  schemaVersion: 1;
  playerName: string;
  minute: number;
  /** Campaign-specific calendar epoch; ordinary campaigns default to 742 KL. */
  worldStartYearKL?: number;
  playerLocation: string;
  money: number;
  inventory: Record<string, number>;
  chronicle: ChronicleEntry[];                 // объективная хроника мира
  playerMemory: MemoryEntry[];                 // что знает игрок
  npcMemory: Record<string, MemoryEntry[]>;    // что помнит каждый NPC
  /** Scripted or simulated NPC deaths, keyed by the in-world minute they occurred. */
  npcDeaths?: Record<string, number>;
  relations: Record<string, Relation>;         // отношение каждого NPC к игроку
  /** Long-term personality learning; baseline traits live in immutable world definitions. */
  npcPsychology?: Record<string, NpcPsychology>;
  /** NPC-to-NPC bonds, independent from each NPC's relationship with the player. */
  npcBonds?: Record<string, Record<string, NpcBond>>;
  /** Текущая внешность игрока: источник истины для визуального описания. */
  playerAppearance?: CharacterAppearanceState;
  /** Изменяемая внешность NPC; при отсутствии записи используется их исходный профиль. */
  npcAppearances?: Record<string, CharacterAppearanceState>;
  /** Последний увиденный каждым NPC облик игрока; legacy-совместимость со старыми сохранениями. */
  npcAppearanceObservations?: Record<string, AppearanceObservation>;
  /** Визуальная память в обе стороны: observerId -> subjectId -> последний снимок. */
  appearanceObservations?: Record<string, Record<string, AppearanceObservation>>;
  /** После подтверждённой смерти действия старого персонажа запрещены. */
  lifeStatus?: "alive" | "dead";
  deathRecord?: DeathRecord;
  /** Реакция общества на заявления героя; не является объективным диагнозом. */
  socialState?: {
    suspicion: number;
    heresySuspicion: number;
    claimCount: number;
    cultAttempts: number;
    followers: string[];
    movement: "none" | "rumor" | "sect" | "cult";
    legalCase: "none" | "watched" | "summoned" | "detained" | "condemned" | "deposed";
    lastClaimMinute?: number;
  };
  /** Развитие персонажа от рождения: этапы, вехи, рост, привязанности, формирование характера. */
  development?: import("./development").DevelopmentState;
  /** Рецепт сборки мира под персонажа: мир восстанавливается из него при загрузке. */
  campaign?: { worldId: string; recipe: unknown };
  /** Какие запланированные события мира уже произошли. */
  processedWorldEvents?: string[];
  /** Сохранённая анкета героя, созданная в интерфейсе. */
  /** Положение на глобальной карте Велории и незавершённый путь. */
  settlementId?: string;
  journey?: {
    destinationId: string;
    route: Array<{ from: string; to: string; days: number; mode: "road" | "river" | "sea" | "mountain-pass"; danger: "low" | "moderate" | "high"; seasonalClosure?: string }>;
    segmentIndex: number;
    daysRemaining: number;
    elapsedDays: number;
  };
  playerProfile?: {
    age: number; originId: string; statusId: string; professionId: string; dynasticRole?: string; birthYearKL?: number;
    familyState: string; startScenarioId: string; biography: string;
    attributes: Record<string, number>; difficultyId: "peaceful" | "balanced" | "harsh";
    heightCm?: number; weightKg?: number; build?: string; hair?: string; hairstyle?: string; eyes?: string; appearance?: string;
    /** Остаток прожитого игрового времени до следующего дня рождения. */
    ageProgressMinutes?: number;
    politicalOffice?: string;
    personality?: string; education?: string; faithId?: string; skills?: string; familyNotes?: string;
    /** Семейные профили и проверенный результат наследования внешности. */
    heritage?: unknown;
    familySummary?: string;
    parentalUnionStatus?: "married" | "unmarried" | "unknown";
  };
}

export interface DeathRecord {
  minute: number;
  cause: string;
  locationId: string;
  witnessedBy: string[];
}

export type Action =
  | { type: "look" }
  | { type: "inventory" }
  | { type: "wait"; minutes: number }
  | { type: "move"; to: string }
  | { type: "buy"; item: string; qty: number }
  | { type: "say"; text: string }
  | { type: "gesture"; text: string }
  | { type: "haircut"; hairstyle: string }
  | { type: "change-clothing"; clothing: string }
  | { type: "clothing-condition"; condition: ClothingCondition; active: boolean }
  | { type: "infant"; act: import("./development").InfantActId }
  | { type: "live"; days: number };

export interface ActionResult {
  state: GameState;
  ok: boolean;
  message: string;
  events: GameEvent[];
}
