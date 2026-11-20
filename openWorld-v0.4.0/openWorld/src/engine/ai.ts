import { applyAction } from "./rules";
import { formatClock } from "./time";
import { npcLocation, npcsAt } from "./world";
import { describeAttitude } from "./relations";
import type { Action, ActionResult, GameState, WorldData } from "./types";

/**
 * Граница между движком и ИИ.
 *
 * ИИ получает только контекст (то, что знает игрок или конкретный NPC) и может
 * вернуть ПРЕДЛОЖЕНИЕ действия. Предложение проходит строгую проверку формы и
 * затем те же правила, что и ввод игрока. ИИ никогда не пишет в состояние.
 *
 * Здесь нет ни ключей API, ни сетевых вызовов: реальный провайдер подключается
 * только через серверный прокси (см. README).
 */
export interface PlayerContext {
  time: string;
  location: { id: string; name: string; description: string };
  presentNpcs: string[];
  recentMemory: string[];
}

export interface NpcContext {
  npc: { id: string; name: string };
  location: { id: string; name: string } | null;
  /** Собственные цели NPC. */
  goals: string[];
  /** Как NPC относится к игроку (словами). */
  attitudeToPlayer: string;
  /** Только собственные воспоминания NPC — не хроника мира и не память игрока. Слухи помечены. */
  memory: string[];
}

export interface ActionProposer {
  propose(context: PlayerContext, playerText: string): Promise<unknown>;
}

export function buildPlayerContext(world: WorldData, state: GameState, memoryLimit = 10): PlayerContext {
  const loc = world.locations[state.playerLocation]!;
  return {
    time: formatClock(state.minute),
    location: { id: loc.id, name: loc.name, description: loc.description },
    presentNpcs: npcsAt(world, state.minute, loc.id).map((id) => world.npcs[id]!.name),
    recentMemory: state.playerMemory.slice(-memoryLimit).map((m) => m.text)
  };
}

export function buildNpcContext(
  world: WorldData, state: GameState, npcId: string, memoryLimit = 10
): NpcContext | null {
  const npc = world.npcs[npcId];
  if (!npc) return null;
  const locId = npcLocation(world, npcId, state.minute);
  const loc = locId ? world.locations[locId] : undefined;
  return {
    npc: { id: npc.id, name: npc.name },
    location: loc ? { id: loc.id, name: loc.name } : null,
    goals: [...npc.goals],
    attitudeToPlayer: state.relations[npcId] ? describeAttitude(state.relations[npcId]!) : "нейтрален",
    memory: (state.npcMemory[npcId] ?? []).slice(-memoryLimit).map((m) =>
      m.kind === "heard"
        ? `${m.text} (слух от ${world.npcs[m.source ?? ""]?.name ?? "кого-то"}, уверенность ${Math.round(m.confidence * 100)}%)`
        : m.text)
  };
}

const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64;
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v);

/** Приводит неизвестный вывод ИИ к Action или возвращает null. Лишние поля отбрасываются. */
export function coerceProposal(raw: unknown): Action | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  switch (r.type) {
    case "look": return { type: "look" };
    case "inventory": return { type: "inventory" };
    case "wait": return isInt(r.minutes) ? { type: "wait", minutes: r.minutes } : null;
    case "move": return isStr(r.to) ? { type: "move", to: r.to } : null;
    case "buy":
      return isStr(r.item) && isInt(r.qty) ? { type: "buy", item: r.item, qty: r.qty } : null;
    default: return null;
  }
}

/** Просит ИИ предложить действие и применяет его по обычным правилам. */
export async function resolveWithAi(
  world: WorldData, state: GameState, playerText: string, proposer: ActionProposer
): Promise<ActionResult> {
  let raw: unknown;
  try {
    raw = await proposer.propose(buildPlayerContext(world, state), playerText);
  } catch {
    return { state, ok: false, message: "ИИ недоступен. Мир не изменился.", events: [] };
  }
  const action = coerceProposal(raw);
  if (!action) {
    return { state, ok: false, message: "ИИ предложил недопустимое действие. Мир не изменился.", events: [] };
  }
  return applyAction(world, state, action);
}
