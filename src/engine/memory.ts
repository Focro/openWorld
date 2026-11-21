import type { ChronicleEntry, GameState, MemoryKind } from "./types";
import { normalize } from "./parse";

export interface ChronicleQuery {
  /** Подстрока текста (без учёта регистра и ё). */
  text?: string;
  fromMinute?: number;
  toMinute?: number;
  locationId?: string;
  /** NPC, бывший свидетелем. */
  witness?: string;
  /** Кто породил событие. */
  sourceId?: string;
}

/** Поиск и фильтрация по хронике мира (объективной). */
export function searchChronicle(state: GameState, q: ChronicleQuery): ChronicleEntry[] {
  const text = q.text ? normalize(q.text) : "";
  return state.chronicle.filter(e =>
    (!text || normalize(e.text).includes(text)) &&
    (q.fromMinute === undefined || e.minute >= q.fromMinute) &&
    (q.toMinute === undefined || e.minute <= q.toMinute) &&
    (!q.locationId || e.locationId === q.locationId) &&
    (!q.witness || e.witnesses.includes(q.witness)) &&
    (!q.sourceId || e.source.id === q.sourceId));
}

export interface Knower { npcId: string; kind: MemoryKind; confidence: number; from?: string }

/**
 * Кто из NPC знает о событии и как: очевидец (уверенность 1) или по слухам.
 * Хроника: правда; записи NPC: их версия. NPC, которых здесь нет, о событии не знают.
 */
export function whoKnows(state: GameState, eventId: string): Knower[] {
  const out: Knower[] = [];
  for (const [npcId, list] of Object.entries(state.npcMemory)) {
    const m = list.find(x => x.eventId === eventId);
    if (m) out.push({ npcId, kind: m.kind, confidence: m.confidence, from: m.source });
  }
  return out;
}

const ROUTINE_TEXT = /обменялись несколькими словами в локации|оказались рядом в локации/;
/** Сколько бытовых фоновых воспоминаний («оказались рядом») хранить на каждого NPC. */
export const ROUTINE_MEMORY_PER_NPC = 8;
/** Предел всех воспоминаний NPC: важное хранится дольше, но не бесконечно. */
export const MEMORY_PER_NPC = 300;

/**
 * Сжимает память NPC: бытовые встречи NPC между собой занимали больше половины сохранения
 * (около 470 КБ за 6 игровых лет). Оставляем последние такие записи и всё значимое.
 * Хроника мира не трогается: на её длине держатся номера событий.
 */
export function compactNpcMemory(state: GameState): GameState {
  const routineEvents = new Set(state.chronicle.filter(e => e.routine || ROUTINE_TEXT.test(e.text)).map(e => e.id));
  let changed = false;
  const npcMemory: GameState["npcMemory"] = {};
  for (const [npcId, list] of Object.entries(state.npcMemory)) {
    const isRoutine = (m: GameState["npcMemory"][string][number]) => (m.eventId !== undefined && routineEvents.has(m.eventId)) || ROUTINE_TEXT.test(m.text);
    const routineCount = list.filter(isRoutine).length;
    if (routineCount <= ROUTINE_MEMORY_PER_NPC && list.length <= MEMORY_PER_NPC) { npcMemory[npcId] = list; continue; }
    changed = true;
    let skipRoutine = routineCount - ROUTINE_MEMORY_PER_NPC;
    const kept = list.filter(m => !(isRoutine(m) && skipRoutine-- > 0));
    npcMemory[npcId] = kept.slice(-MEMORY_PER_NPC);
  }
  return changed ? { ...state, npcMemory } : state;
}
