/** Статические определения мира (не меняются во время игры). */
export interface Exit { to: string; minutes: number }
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
export interface NpcDef {
  id: string;
  name: string;
  homeId: string;
  /** Собственные цели NPC (он знает их о себе; игрок — нет). */
  goals: string[];
  schedule: ScheduleEntry[];
}
export interface WorldData {
  name: string;
  startLocationId: string;
  startMoney: number;
  startInventory: Record<string, number>;
  locations: Record<string, LocationDef>;
  items: Record<string, ItemDef>;
  npcs: Record<string, NpcDef>;
}

/**
 * Раздельные хранилища памяти.
 * own — личный опыт игрока; witnessed — NPC видел сам; heard — слух (мнение с уверенностью < 1).
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
}
/** Хроника хранит объективные события мира. */
export type ChronicleEntry = GameEvent;

/** Отношение NPC к игроку: четыре независимых параметра, каждый −100..100. */
export interface Relation { trust: number; sympathy: number; fear: number; respect: number }

/** Динамическое состояние — единственный источник истины. */
export interface GameState {
  schemaVersion: 1;
  playerName: string;
  minute: number;
  playerLocation: string;
  money: number;
  inventory: Record<string, number>;
  chronicle: ChronicleEntry[];                 // объективная хроника мира
  playerMemory: MemoryEntry[];                 // что знает игрок
  npcMemory: Record<string, MemoryEntry[]>;    // что помнит каждый NPC
  relations: Record<string, Relation>;         // отношение каждого NPC к игроку
}

export type Action =
  | { type: "look" }
  | { type: "inventory" }
  | { type: "wait"; minutes: number }
  | { type: "move"; to: string }
  | { type: "buy"; item: string; qty: number };

export interface ActionResult {
  state: GameState;
  ok: boolean;
  message: string;
  events: GameEvent[];
}
