import { START_MINUTE, hourInRange, hourOf } from "./time";
import { neutralRelation } from "./relations";
import type { GameState, WorldData } from "./types";

export const defaultWorld: WorldData = {
  name: "Новый мир",
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
        { to: "market", minutes: 10 },
        { to: "tavern", minutes: 5 },
        { to: "gate", minutes: 15 }
      ]
    },
    market: {
      id: "market", name: "Рынок",
      description: "Ряды прилавков, пахнет свежим хлебом и дублёной кожей.",
      exits: [{ to: "square", minutes: 10 }],
      shop: { keeperId: "marta", prices: { bread: 3, rope: 12 } }
    },
    tavern: {
      id: "tavern", name: "Таверна Сонный бык",
      description: "Низкий зал с закопчёнными балками и запахом похлёбки.",
      exits: [{ to: "square", minutes: 5 }]
    },
    gate: {
      id: "gate", name: "Городские ворота",
      description: "Тяжёлые створки, рядом караульная будка.",
      exits: [{ to: "square", minutes: 15 }]
    }
  },
  npcs: {
    marta: {
      id: "marta", name: "Марта", homeId: "tavern",
      goals: ["Копить на собственную пекарню", "Не дать цене на муку съесть прибыль"],
      schedule: [
        { from: 7, to: 19, locationId: "market", activity: "торгует хлебом" },
        { from: 19, to: 23, locationId: "tavern", activity: "ужинает" }
      ]
    },
    vilem: {
      id: "vilem", name: "Вилем", homeId: "tavern",
      goals: ["Не пропустить в город чужаков с оружием"],
      schedule: [{ from: 6, to: 22, locationId: "gate", activity: "стоит на страже" }]
    },
    ion: {
      id: "ion", name: "Старый Ион", homeId: "tavern",
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
    playerName,
    minute: START_MINUTE,
    playerLocation: world.startLocationId,
    money: world.startMoney,
    inventory: { ...world.startInventory },
    chronicle: [],
    playerMemory: [{
      minute: START_MINUTE, text: "Вы приходите в себя на городской площади.", kind: "own", confidence: 1
    }],
    npcMemory: Object.fromEntries(Object.keys(world.npcs).map((id) => [id, []])),
    relations: Object.fromEntries(Object.keys(world.npcs).map((id) => [id, neutralRelation()]))
  };
}

/** Где находится NPC в заданную минуту — по расписанию, иначе дома. */
export function npcLocation(world: WorldData, npcId: string, minute: number): string | null {
  const npc = world.npcs[npcId];
  if (!npc) return null;
  const hour = hourOf(minute);
  const entry = npc.schedule.find((s) => hourInRange(hour, s.from, s.to));
  return entry ? entry.locationId : npc.homeId;
}

export function npcsAt(world: WorldData, minute: number, locationId: string): string[] {
  return Object.keys(world.npcs).filter((id) => npcLocation(world, id, minute) === locationId);
}

/** Чем NPC занят в заданную минуту (по расписанию). */
export function npcActivity(world: WorldData, npcId: string, minute: number): string {
  const npc = world.npcs[npcId];
  if (!npc) return "";
  const hour = hourOf(minute);
  return npc.schedule.find((s) => hourInRange(hour, s.from, s.to))?.activity ?? "отдыхает дома";
}
