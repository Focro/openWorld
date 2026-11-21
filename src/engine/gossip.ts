import { npcLocation } from "./world";
import type { GameState, MemoryEntry, WorldData } from "./types";

/** Во сколько раз падает уверенность при каждой передаче слуха. */
export const GOSSIP_FACTOR = 0.7;
/** Ниже этой уверенности NPC уже не пересказывает запись. */
export const GOSSIP_MIN_SHARE = 0.3;
/** Слух старше этого срока забывается. */
export const RUMOR_TTL_MINUTES = 3 * 1440;
/** Слух с уверенностью ниже порога забывается. */
export const RUMOR_DROP_BELOW = 0.2;

/**
 * Один «шаг» слухов: NPC, находящиеся сейчас в одной локации, пересказывают друг другу
 * события, о которых другой ещё не знает. Детерминировано (порядок по id), без случайности.
 * За один вызов слух проходит ровно один «прыжок».
 *
 * Упрощение: шаг выполняется в моменты действий игрока, а не непрерывно.
 */
export function spreadGossip(world: WorldData, state: GameState): GameState {
  const groups = new Map<string, string[]>();
  for (const id of Object.keys(world.npcs).sort()) {
    const loc = npcLocation(world, id, state.minute, state.npcDeaths);
    if (!loc) continue;
    groups.set(loc, [...(groups.get(loc) ?? []), id]);
  }

  const npcMemory: Record<string, MemoryEntry[]> = { ...state.npcMemory };
  let changed = false;
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    for (const listener of members) {
      const best = new Map<string, { entry: MemoryEntry; teller: string }>();
      for (const teller of members) {
        if (teller === listener) continue;
        for (const entry of state.npcMemory[teller] ?? []) {
          if (!entry.eventId || entry.confidence < GOSSIP_MIN_SHARE) continue;
          if ((state.npcMemory[listener] ?? []).some(m => m.eventId === entry.eventId)) continue;
          const cur = best.get(entry.eventId);
          if (!cur || entry.confidence > cur.entry.confidence) best.set(entry.eventId, { entry, teller });
        }
      }
      for (const { entry, teller } of best.values()) {
        npcMemory[listener] = [...(npcMemory[listener] ?? []), {
          minute: state.minute, text: entry.text, kind: "heard",
          confidence: entry.confidence * GOSSIP_FACTOR, eventId: entry.eventId!, source: teller
        }];
        changed = true;
      }
    }
  }
  return changed ? { ...state, npcMemory } : state;
}

/** Забывает устаревшие и слишком неуверенные слухи. Очевидцев не затрагивает. */
export function pruneRumors(state: GameState): GameState {
  let changed = false;
  const npcMemory: Record<string, MemoryEntry[]> = {};
  for (const [id, list] of Object.entries(state.npcMemory)) {
    const kept = list.filter(m =>
      m.kind !== "heard" ||
      (state.minute - m.minute <= RUMOR_TTL_MINUTES && m.confidence >= RUMOR_DROP_BELOW));
    if (kept.length !== list.length) changed = true;
    npcMemory[id] = kept;
  }
  return changed ? { ...state, npcMemory } : state;
}
