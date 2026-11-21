import { START_MINUTE, hourInRange, hourOf } from "./time";
import { neutralRelation } from "./relations";
import { travelMinutes } from "./geography";
import { createInitialNpcBonds, createNpcPsychology } from "./personality";
import type { GameState, WorldData } from "./types";

export const defaultWorld: WorldData = {
  name: "Демо-мир",
  startLocationId: "square",
  startMoney: 20,
  startInventory: { clothes: 1 },
  items: {
    clothes: { id: "clothes", name: "Потрёпанная одежда" },
    bread: { id: "bread", name: "Хлеб" },
    rope: { id: "rope", name: "Верёвка" }
  },
  locations: {
    square: {
      id: "square", name: "Городская площадь",
      description: "Мощёная площадь с выщербленным фонтаном в центре.",
      exits: [
        { to: "market", distanceM: 800, terrain: "street" },
        { to: "tavern", distanceM: 400, terrain: "street" },
        { to: "gate", distanceM: 1200, terrain: "road" }
      ]
    },
    market: {
      id: "market", name: "Рынок",
      description: "Ряды прилавков, пахнет свежим хлебом и дублёной кожей.",
      exits: [{ to: "square", distanceM: 800, terrain: "street" }],
      shop: { keeperId: "marta", prices: { bread: 3, rope: 12 } }
    },
    tavern: {
      id: "tavern", name: "Таверна Сонный бык",
      description: "Низкий зал с закопчёнными балками и запахом похлёбки.",
      exits: [{ to: "square", distanceM: 400, terrain: "street" }]
    },
    gate: {
      id: "gate", name: "Городские ворота",
      description: "Тяжёлые створки, рядом караульная будка.",
      exits: [{ to: "square", distanceM: 1200, terrain: "road" }]
    }
  },
  npcs: {
    marta: {
      id: "marta", name: "Марта", homeId: "tavern", roleTags: ["merchant", "commoner"],
      goals: ["Копить на собственную пекарню", "Не дать цене на муку съесть прибыль"],
      schedule: [
        { from: 7, to: 19, locationId: "market", activity: "торгует хлебом" },
        { from: 19, to: 23, locationId: "tavern", activity: "ужинает" }
      ]
    },
    vilem: {
      id: "vilem", name: "Вилем", homeId: "tavern", roleTags: ["guard", "commoner"],
      goals: ["Не пропустить в город чужаков с оружием"],
      schedule: [{ from: 6, to: 22, locationId: "gate", activity: "стоит на страже" }]
    },
    ion: {
      id: "ion", name: "Старый Ион", homeId: "tavern", roleTags: ["commoner"],
      goals: ["Узнавать все новости города", "Выпросить на кружку эля"],
      schedule: [
        { from: 6, to: 20, locationId: "square", activity: "просит милостыню" },
        { from: 20, to: 24, locationId: "tavern", activity: "пьёт эль" }
      ]
    }
  }
};

export function createInitialState(world: WorldData, playerName = "Путник"): GameState {
  return {
    schemaVersion: 1,
    lifeStatus: "alive",
    socialState: { suspicion: 0, heresySuspicion: 0, claimCount: 0, cultAttempts: 0, followers: [], movement: "none", legalCase: "none" },
    settlementId: world.globalStartId,
    worldStartYearKL: world.startYearKL,
    playerName,
    minute: START_MINUTE,
    playerLocation: world.startLocationId,
    money: world.startMoney,
    inventory: { ...world.startInventory },
    chronicle: [],
    playerMemory: [{
      minute: START_MINUTE,
      text: `Вы приходите в себя: ${world.locations[world.startLocationId]?.name ?? "неизвестное место"}.`,
      kind: "own", confidence: 1
    }],
    npcMemory: Object.fromEntries(Object.keys(world.npcs).map((id) => [id, []])),
    relations: Object.fromEntries(Object.keys(world.npcs).map((id) => [id, neutralRelation()])),
    npcPsychology: Object.fromEntries(Object.values(world.npcs).map(npc => [npc.id, createNpcPsychology(npc, START_MINUTE)])),
    npcBonds: createInitialNpcBonds(world)
  };
}

export type NpcPresence =
  | { kind: "at"; locationId: string }
  | { kind: "traveling"; from: string; to: string; minutesRemaining: number };

/** Кратчайшее время пешего перехода по локальным улицам; недостижимый путь возвращает null. */
const walkCache = new WeakMap<WorldData, Map<string, number | null>>();
function localWalkMinutes(world: WorldData, from: string, to: string): number | null {
  if (from === to) return 0;
  let cache = walkCache.get(world);
  if (!cache) { cache = new Map(); walkCache.set(world, cache); }
  const key = `${from}\u0000${to}`;
  if (cache.has(key)) return cache.get(key)!;
  const result = computeLocalWalkMinutes(world, from, to);
  cache.set(key, result);
  return result;
}
/** Мир статичен во время игры, поэтому кратчайшие пути кэшируются по объекту мира. */
function computeLocalWalkMinutes(world: WorldData, from: string, to: string): number | null {
  if (!world.locations[from] || !world.locations[to]) return null;
  const distances = new Map<string, number>([[from, 0]]);
  const pending = new Set(Object.keys(world.locations));
  while (pending.size) {
    let current: string | undefined;
    let best = Number.POSITIVE_INFINITY;
    for (const id of pending) {
      const distance = distances.get(id);
      if (distance !== undefined && distance < best) { current = id; best = distance; }
    }
    if (!current) break;
    if (current === to) return best;
    pending.delete(current);
    for (const exit of world.locations[current]!.exits) {
      if (!pending.has(exit.to)) continue;
      const cost = travelMinutes(exit.distanceM, exit.terrain, "walk");
      if (cost === null) continue;
      const candidate = best + cost;
      if (candidate < (distances.get(exit.to) ?? Number.POSITIVE_INFINITY)) distances.set(exit.to, candidate);
    }
  }
  return null;
}

/** Какое расписание действует для NPC в эту минуту (с учётом возраста, если он задан). */
export function activeSchedule(npc: import("./types").NpcDef, minute: number): import("./types").ScheduleEntry[] {
  if (!npc.lifeSchedules?.length || npc.bornAtMinute === undefined) return npc.schedule;
  const age = (minute - npc.bornAtMinute) / (365 * 1440);
  let chosen = npc.schedule;
  for (const entry of [...npc.lifeSchedules].sort((a, b) => a.fromAgeYears - b.fromAgeYears)) if (age >= entry.fromAgeYears) chosen = entry.schedule;
  return chosen;
}

/** NPC существует в эту минуту: родился, не умер и не пропал. */
export function npcExistsAt(world: WorldData, npcId: string, minute: number, npcDeaths?: Record<string, number>): boolean {
  const npc = world.npcs[npcId];
  if (!npc || npc.lifeStatus === "dead" || npc.lifeStatus === "missing") return false;
  if (npc.bornAtMinute !== undefined && minute < npc.bornAtMinute) return false;
  return !(npcDeaths?.[npcId] !== undefined && npcDeaths[npcId]! <= minute);
}

/** Физическое положение NPC с учётом времени пешего перехода между точками расписания. */
export function npcPresence(world: WorldData, npcId: string, minute: number, npcDeaths?: Record<string, number>): NpcPresence | null {
  const npc = world.npcs[npcId];
  if (!npc || !npcExistsAt(world, npcId, minute, npcDeaths)) return null;
  const schedule = activeSchedule(npc, minute);
  const minuteOfDay = ((minute % 1440) + 1440) % 1440;
  const activeIndex = schedule.findIndex(entry => hourInRange(Math.floor(minuteOfDay / 60), entry.from, entry.to));

  if (activeIndex >= 0) {
    const entry = schedule[activeIndex]!;
    const previous = activeIndex > 0 ? schedule[activeIndex - 1] : undefined;
    let from = npc.homeId;
    if (previous) {
      const gap = Math.max(0, (entry.from - previous.to) * 60);
      const returnHome = localWalkMinutes(world, previous.locationId, npc.homeId);
      from = returnHome !== null && gap >= returnHome ? npc.homeId : previous.locationId;
    }
    if (from === entry.locationId) return { kind: "at", locationId: entry.locationId };
    const duration = localWalkMinutes(world, from, entry.locationId);
    if (duration === null) return { kind: "traveling", from, to: entry.locationId, minutesRemaining: Number.POSITIVE_INFINITY };
    const elapsed = minuteOfDay - entry.from * 60;
    if (elapsed < duration) return { kind: "traveling", from, to: entry.locationId, minutesRemaining: duration - Math.max(0, elapsed) };
    return { kind: "at", locationId: entry.locationId };
  }

  const previous = [...schedule].reverse().find(entry => entry.to * 60 <= minuteOfDay);
  if (!previous || previous.locationId === npc.homeId) return { kind: "at", locationId: npc.homeId };
  const duration = localWalkMinutes(world, previous.locationId, npc.homeId);
  if (duration === null) return { kind: "traveling", from: previous.locationId, to: npc.homeId, minutesRemaining: Number.POSITIVE_INFINITY };
  const elapsed = minuteOfDay - previous.to * 60;
  if (elapsed < duration) return { kind: "traveling", from: previous.locationId, to: npc.homeId, minutesRemaining: duration - Math.max(0, elapsed) };
  return { kind: "at", locationId: npc.homeId };
}

/** Совместимый accessor: во время перехода NPC не считается находящимся в помещении/локации. */
export function npcLocation(world: WorldData, npcId: string, minute: number, npcDeaths?: Record<string, number>): string | null {
  const presence = npcPresence(world, npcId, minute, npcDeaths);
  return presence?.kind === "at" ? presence.locationId : null;
}

export function npcsAt(world: WorldData, minute: number, locationId: string, npcDeaths?: Record<string, number>): string[] {
  return Object.keys(world.npcs).filter((id) => npcLocation(world, id, minute, npcDeaths) === locationId);
}

/** Чем NPC занят в заданную минуту (по расписанию). */
export function npcActivity(world: WorldData, npcId: string, minute: number, npcDeaths?: Record<string, number>): string {
  const npc = world.npcs[npcId];
  if (!npc) return "";
  if (npc.lifeStatus === "dead") return "умер(ла)";
  if (npc.lifeStatus === "missing") return "пропал(а), местонахождение неизвестно";
  if (npcDeaths?.[npcId] !== undefined && npcDeaths[npcId]! <= minute) return "умер(ла)";
  if (npc.bornAtMinute !== undefined && minute < npc.bornAtMinute) return "ещё не родился(ась)";
  const presence = npcPresence(world, npcId, minute, npcDeaths);
  if (presence?.kind === "traveling") {
    const from = world.locations[presence.from]?.name ?? presence.from;
    const to = world.locations[presence.to]?.name ?? presence.to;
    return `идёт из «${from}» в «${to}»`;
  }
  const hour = hourOf(minute);
  return activeSchedule(npc, minute).find((s) => hourInRange(hour, s.from, s.to))?.activity ?? "отдыхает дома";
}
