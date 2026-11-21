/**
 * Люди, которых знает герой (0.18.0): для экрана «Память».
 *
 * Игрок видит, кто эти люди и какие они с виду и по нраву. Что они помнят о герое
 * и как к нему относятся, не показывается: это живёт внутри мира, за спиной игрока.
 */
import type { GameState, WorldData } from "./types";
import { npcAgeYears } from "./speech";
import { describeAppearance } from "./appearance";
import { npcExistsAt } from "./world";

export interface Acquaintance { id: string; name: string; age?: number; nature?: string; looks?: string; alive: boolean; family: boolean }

const yearsWord = (n: number) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? "год" : a >= 2 && a <= 4 && (b < 12 || b > 14) ? "года" : "лет"; };
export const ageText = (age: number) => age < 1 ? "меньше года" : `${age} ${yearsWord(age)}`;

export function knownPeople(world: WorldData, state: GameState): Acquaintance[] {
  const ids = new Set<string>();
  for (const id of Object.keys(state.development?.attachments ?? {})) ids.add(id);
  for (const [id, mem] of Object.entries(state.npcMemory ?? {})) if (mem.length) ids.add(id);
  for (const id of Object.keys(world.npcs)) if (id.startsWith("birth-family-") && world.npcs[id]!.familyRole) ids.add(id);
  const out: Acquaintance[] = [];
  for (const id of ids) {
    const npc = world.npcs[id];
    if (!npc) continue;
    if (npc.bornAtMinute !== undefined && npc.bornAtMinute > state.minute) continue;
    const alive = npc.lifeStatus !== "dead" && !(state.npcDeaths && state.npcDeaths[id] !== undefined && state.npcDeaths[id]! <= state.minute) && npcExistsAt(world, id, state.minute, state.npcDeaths);
    // Нрав без служебной роли впереди: «мать: заботливая; напевает» → «заботливая; напевает».
    const nature = npc.personality?.temperament.replace(/^[^:]{1,40}:\s*/, "").trim();
    const appearance = state.npcAppearances?.[id] ?? npc.appearance;
    out.push({ id, name: npc.name, age: npcAgeYears(npc, state), nature: nature || undefined, looks: appearance ? describeAppearance(appearance) : undefined, alive, family: id.startsWith("birth-family-") });
  }
  return out.sort((a, b) => Number(b.family) - Number(a.family) || Number(b.alive) - Number(a.alive) || a.name.localeCompare(b.name, "ru"));
}
