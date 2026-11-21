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
 * Хроника — правда; записи NPC — их версия. NPC, которых здесь нет, о событии не знают.
 */
export function whoKnows(state: GameState, eventId: string): Knower[] {
  const out: Knower[] = [];
  for (const [npcId, list] of Object.entries(state.npcMemory)) {
    const m = list.find(x => x.eventId === eventId);
    if (m) out.push({ npcId, kind: m.kind, confidence: m.confidence, from: m.source });
  }
  return out;
}
