import { npcActivity, npcsAt } from "./world";
import { applyRelationDelta } from "./relations";
import { pruneRumors, spreadGossip } from "./gossip";
import { formatClock } from "./time";
import type { Action, ActionResult, GameEvent, GameState, Relation, WorldData } from "./types";

export const MAX_WAIT_MINUTES = 720;
export const MAX_BUY_QTY = 99;

export function coins(n: number): string {
  const mod100 = n % 100, mod10 = n % 10;
  if (mod10 === 1 && mod100 !== 11) return `${n} монета`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} монеты`;
  return `${n} монет`;
}

const reject = (state: GameState, message: string): ActionResult =>
  ({ state, ok: false, message, events: [] });

const info = (state: GameState, message: string): ActionResult =>
  ({ state, ok: true, message, events: [] });

/** Записывает событие в хронику, память игрока и память NPC-свидетелей. */
function commit(
  world: WorldData,
  state: GameState,
  patch: Partial<GameState>,
  ev: {
    locationId: string; text: string; playerText: string;
    /** Изменения отношений, вызванные именно этим событием. */
    relations?: Record<string, Partial<Relation>>;
  }
): ActionResult {
  const base: GameState = { ...state, ...patch };
  const witnesses = npcsAt(world, base.minute, ev.locationId);
  const event: GameEvent = {
    id: `e${base.chronicle.length + 1}`,
    minute: base.minute, locationId: ev.locationId, text: ev.text, witnesses,
    source: { kind: "player" }
  };
  const npcMemory = { ...base.npcMemory };
  for (const npcId of witnesses) {
    npcMemory[npcId] = [...(npcMemory[npcId] ?? []), {
      minute: base.minute, text: ev.text, kind: "witnessed", confidence: 1, eventId: event.id
    }];
  }
  const relations = { ...base.relations };
  for (const [npcId, delta] of Object.entries(ev.relations ?? {})) {
    const current = relations[npcId];
    if (current) relations[npcId] = applyRelationDelta(current, delta);
  }
  const withEvent: GameState = {
    ...base,
    chronicle: [...base.chronicle, event],
    playerMemory: [...base.playerMemory, {
      minute: base.minute, text: ev.playerText, kind: "own", confidence: 1, eventId: event.id
    }],
    npcMemory,
    relations
  };
  // Слухи распространяются между NPC, оказавшимися в одной локации; устаревшие забываются.
  const next = pruneRumors(spreadGossip(world, withEvent));
  return { state: next, ok: true, message: ev.playerText, events: [event] };
}

/**
 * Единственная точка изменения мира. Чистая функция: недопустимое действие
 * возвращает тот же объект состояния без наград и без событий.
 */
export function applyAction(world: WorldData, state: GameState, action: Action): ActionResult {
  const here = world.locations[state.playerLocation];
  if (!here) return reject(state, "Текущая локация неизвестна. Мир не изменился.");

  switch (action.type) {
    case "look": {
      const present = npcsAt(world, state.minute, here.id)
        .map((id) => `${world.npcs[id]!.name} (${npcActivity(world, id, state.minute)})`);
      const exits = here.exits
        .map((e) => `${world.locations[e.to]?.name ?? e.to} (${e.minutes} мин)`).join(", ");
      return info(state,
        `${here.name}. ${here.description} ` +
        `${present.length ? `Здесь: ${present.join(", ")}.` : "Здесь никого нет."} ` +
        `Выходы: ${exits || "нет"}.`);
    }
    case "inventory": {
      const items = Object.entries(state.inventory)
        .filter(([, n]) => n > 0)
        .map(([id, n]) => `${world.items[id]?.name ?? id}${n > 1 ? ` ×${n}` : ""}`);
      return info(state, `При себе: ${items.join(", ") || "ничего"}. Деньги: ${coins(state.money)}.`);
    }
    case "wait": {
      const m = action.minutes;
      if (!Number.isInteger(m) || m < 1 || m > MAX_WAIT_MINUTES)
        return reject(state, `Ждать можно от 1 до ${MAX_WAIT_MINUTES} минут. Мир не изменился.`);
      const minute = state.minute + m;
      return commit(world, state, { minute }, {
        locationId: here.id,
        text: `${state.playerName} ждёт ${m} мин. в локации «${here.name}».`,
        playerText: `Проходит ${m} мин. Сейчас ${formatClock(minute)}.`
      });
    }
    case "move": {
      const exit = here.exits.find((e) => e.to === action.to);
      const target = typeof action.to === "string" ? world.locations[action.to] : undefined;
      if (!exit || !target)
        return reject(state, "Отсюда нет такого пути. Мир не изменился.");
      const minute = state.minute + exit.minutes;
      return commit(world, state, { minute, playerLocation: target.id }, {
        locationId: target.id,
        text: `${state.playerName} приходит в локацию «${target.name}».`,
        playerText: `Вы идёте ${exit.minutes} мин и приходите: ${target.name}. Сейчас ${formatClock(minute)}.`
      });
    }
    case "buy": {
      const shop = here.shop;
      const item = typeof action.item === "string" ? world.items[action.item] : undefined;
      if (!shop) return reject(state, "Здесь ничего не продают. Мир не изменился.");
      if (!npcsAt(world, state.minute, here.id).includes(shop.keeperId))
        return reject(state, "Продавца сейчас нет на месте. Мир не изменился.");
      const price = item ? shop.prices[item.id] : undefined;
      if (!item || price === undefined) return reject(state, "Такого товара здесь нет. Мир не изменился.");
      if (!Number.isInteger(action.qty) || action.qty < 1 || action.qty > MAX_BUY_QTY)
        return reject(state, `Количество — от 1 до ${MAX_BUY_QTY}. Мир не изменился.`);
      const cost = price * action.qty;
      if (cost > state.money)
        return reject(state, `Не хватает денег: нужно ${coins(cost)}, у вас ${coins(state.money)}.`);
      const keeper = world.npcs[shop.keeperId]!.name;
      return commit(world, state, {
        money: state.money - cost,
        inventory: { ...state.inventory, [item.id]: (state.inventory[item.id] ?? 0) + action.qty }
      }, {
        locationId: here.id,
        text: `${state.playerName} купил у ${keeper}: ${item.name} ×${action.qty} за ${coins(cost)}.`,
        playerText: `Вы покупаете: ${item.name} ×${action.qty} за ${coins(cost)}.`,
        relations: { [shop.keeperId]: { trust: 2, sympathy: 1 } }
      });
    }
    default:
      return reject(state, "Неизвестное действие. Мир не изменился.");
  }
}
