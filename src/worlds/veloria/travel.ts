import type { GameEvent, GameState } from "../../engine/types";
import { advanceCharacterAge } from "../../engine/lifecycle";
import { dayOfYear } from "../../engine/time";
import { MAP_NODES, ROUTES } from "./atlas";
import type { Route } from "./atlas";
import { settlementGateLocationId } from "./settlementMaps";
import { heroAgeYears } from "../../engine/speech";

/** С этого возраста можно уходить в дорогу самому. Младше: только сбежать или уйти, если некому держать. */
export const MIN_SOLO_TRAVEL_AGE = 14;
/** Младше этого ребёнок сам из поселения не уйдёт вовсе. */
export const MIN_WALK_AWAY_AGE = 6;

/** Детерминированный бросок: один и тот же ход в ту же минуту даёт тот же исход. */
function roll(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
const attr = (state: GameState, name: string) => state.playerProfile?.attributes?.[name] ?? 14;
/** Шанс тайком уйти от семьи: старше, ловчее и умнее, тем выше. */
export function runawayChance(state: GameState, age: number): number {
  return Math.max(0.05, Math.min(0.7, 0.15 + (age - MIN_WALK_AWAY_AGE) * 0.05 + (attr(state, "Ловкость") - 14) / 60 + (attr(state, "Интеллект") - 14) / 80));
}
export interface JourneyOptions {
  /** Рядом есть те, кто за ребёнком смотрит (родители, опекуны, няня). Без них ребёнок может уйти сам. */
  hasGuardians?: boolean;
  /** Идти только по суше, без моря (дольше, зато без платы за судно). */
  overlandOnly?: boolean;
}
/** Плата за место на судне в день пути (монеты). Пешком по дороге платить не нужно. */
export const FARE_PER_DAY: Record<Route["mode"], number> = { road: 0, "mountain-pass": 0, river: 2, sea: 4 };
export const routeFare = (segments: Route[]) => segments.reduce((sum, seg) => sum + FARE_PER_DAY[seg.mode] * seg.days, 0);

export interface RoutePlan {
  from: string;
  to: string;
  segments: Route[];
  totalDays: number;
  danger: "low" | "moderate" | "high";
}

const nodeIds = new Set(MAP_NODES.map(node => node.id));
const dangerWeight: Record<Route["danger"], number> = { low: 0, moderate: 1, high: 2 };

function recordTravel(state: GameState, minute: number, text: string, locationId: string): GameState {
  const event: GameEvent = {
    id: `travel-${minute}-${state.chronicle.length}`,
    minute,
    locationId,
    text,
    witnesses: [],
    source: { kind: "system" }
  };
  return {
    ...state,
    chronicle: [...state.chronicle, event],
    playerMemory: [...state.playerMemory, { minute, text, kind: "own", confidence: 1, eventId: event.id }]
  };
}

/** Находит кратчайший по игровым дням путь. Дороги двусторонние, если это явно не запрещено будущими правилами. */
/** Велорийский календарь: месяцы 10–12 и пять межсезонных дней считаются зимним периодом. */
export function isRouteSeasonallyClosed(route: Route, minute: number): boolean {
  if (!route.seasonalClosure) return false;
  const day = dayOfYear(minute);
  const monthIndex = Math.floor((day - 1) / 30);
  const winter = monthIndex >= 9 || day > 360;
  const text = route.seasonalClosure.toLocaleLowerCase("ru-RU");
  return winter && /(зим|снег|лавин|перевал закрыт)/u.test(text);
}

export function findVeloriaRoute(from: string, to: string, minute = 0, options: { overlandOnly?: boolean } = {}): RoutePlan | null {
  if (!nodeIds.has(from) || !nodeIds.has(to)) return null;
  if (from === to) return { from, to, segments: [], totalDays: 0, danger: "low" };

  const best = new Map<string, { days: number; risk: number; path: Route[] }>();
  const pending = new Set(nodeIds);
  best.set(from, { days: 0, risk: 0, path: [] });

  while (pending.size) {
    let current: string | undefined;
    let selected: { days: number; risk: number } | undefined;
    for (const id of pending) {
      const value = best.get(id);
      if (value && (!selected || value.days < selected.days || (value.days === selected.days && value.risk < selected.risk))) {
        current = id;
        selected = value;
      }
    }
    if (!current) break;
    if (current === to) break;
    pending.delete(current);
    const currentBest = best.get(current)!;

    for (const edge of ROUTES) {
      if (isRouteSeasonallyClosed(edge, minute)) continue;
      if (options.overlandOnly && edge.mode === "sea") continue;
      const next = edge.from === current ? edge.to : edge.to === current ? edge.from : null;
      if (!next || !pending.has(next)) continue;
      const oriented: Route = edge.from === current ? edge : { ...edge, from: current, to: next };
      const candidate = {
        days: currentBest.days + edge.days,
        risk: currentBest.risk + dangerWeight[edge.danger],
        path: [...currentBest.path, oriented]
      };
      const previous = best.get(next);
      if (!previous || candidate.days < previous.days || (candidate.days === previous.days && candidate.risk < previous.risk)) best.set(next, candidate);
    }
  }

  const result = best.get(to);
  if (!result) return null;
  const maxDanger = Math.max(0, ...result.path.map(edge => dangerWeight[edge.danger]));
  const danger = (Object.keys(dangerWeight) as Route["danger"][]).find(key => dangerWeight[key] === maxDanger) ?? "low";
  return { from, to, segments: result.path, totalDays: result.days, danger };
}

export function beginVeloriaJourney(state: GameState, destinationId: string, options: JourneyOptions = {}): { state: GameState; message: string; ok: boolean } {
  if (state.lifeStatus === "dead") return { state, ok: false, message: "Путешествие невозможно: жизнь этого персонажа завершена." };
  if (state.journey) return { state, ok: false, message: "Вы уже находитесь в пути. Сначала завершите начатое путешествие." };
  const from = state.settlementId ?? "roven";
  const gateLocationId = settlementGateLocationId(from);
  if (state.playerLocation !== gateLocationId) {
    const gateName = from === "roven" ? "Южных ворот" : "местных ворот или пристани";
    return { state, ok: false, message: `Чтобы покинуть поселение, сначала доберитесь до ${gateName}. Путь проходит через местные улицы.` };
  }
  const plan = findVeloriaRoute(from, destinationId, state.minute, { overlandOnly: options.overlandOnly });
  if (!plan || !plan.segments.length) return { state, ok: false, message: "Маршрут не найден или вы уже находитесь в этом поселении." };
  // Правдоподобие (решение автора): малыш сам не уйдёт; ребёнка при семье не отпустят, но он может сбежать;
  // сирота без опекунов может уйти сам. Дорога для ребёнка без взрослых опаснее.
  const age = heroAgeYears(state);
  const child = age !== undefined && age < MIN_SOLO_TRAVEL_AGE;
  if (child && age! < MIN_WALK_AWAY_AGE) return { state, ok: false, message: "Вы ещё слишком малы, чтобы уйти куда-то самому: дальше ворот вас не унесут ноги." };
  let runawayFrom: string | undefined;
  if (child && options.hasGuardians) {
    if (roll(`${state.minute}:${destinationId}:${state.lifeId ?? state.playerName}:runaway`) >= runawayChance(state, age!)) {
      const caught = { ...state, minute: state.minute + 30 };
      const message = "Вы пытаетесь тайком уйти из поселения, но взрослые замечают и возвращают вас. Одного ребёнка в дальнюю дорогу не отпустят.";
      return { state: recordTravel(caught, caught.minute, message, from), ok: false, message };
    }
    runawayFrom = from;
  }
  const fare = routeFare(plan.segments);
  if (fare > state.money) return { state, ok: false, message: `Место на судне на весь путь стоит около ${fare} монет, а у вас ${state.money}. Пешком туда не дойти.` };
  const first = plan.segments[0]!;
  const next: GameState = { ...state, money: state.money - fare, journey: { destinationId, route: plan.segments, segmentIndex: 0, daysRemaining: first.days, elapsedDays: 0, ...(child ? { alone: true } : {}), ...(runawayFrom ? { runawayFrom } : {}) } };
  const message = `Вы отправляетесь из ${MAP_NODES.find(n => n.id === from)?.name ?? from}.${fare ? ` За место на судне отдано ${fare} монет.` : ""} Путь займёт около ${plan.totalDays} дней; опасность маршрута: ${plan.danger === "low" ? "низкая" : plan.danger === "moderate" ? "умеренная" : "высокая"}.${runawayFrom ? " Вы ушли тайком: дома вас скоро хватятся и станут искать." : child ? " Вы идёте один, без взрослых: для ребёнка дорога куда опаснее." : ""}`;
  return { state: recordTravel(next, state.minute, message, `route:${first.from}->${first.to}`), ok: true, message };
}

/** Варианты пути для справки на карте: самый быстрый и, если он идёт морем, самый быстрый по суше. */
export function travelOptions(from: string, to: string, minute = 0): Array<{ overland: boolean; plan: RoutePlan }> {
  const fastest = findVeloriaRoute(from, to, minute);
  if (!fastest) return [];
  const out = [{ overland: !fastest.segments.some(s => s.mode === "sea"), plan: fastest }];
  if (!out[0]!.overland) { const land = findVeloriaRoute(from, to, minute, { overlandOnly: true }); if (land) out.push({ overland: true, plan: land }); }
  return out;
}

/** Продвигает путешествие ровно на один день. Игрок не переносится сразу в пункт назначения. */
export function advanceVeloriaJourney(state: GameState): { state: GameState; message: string; arrived: boolean; ok: boolean } {
  if (state.lifeStatus === "dead") return { state, ok: false, arrived: false, message: "Путь этого персонажа завершён вместе с его жизнью." };
  const journey = state.journey;
  if (!journey) return { state, ok: false, arrived: false, message: "Вы сейчас не путешествуете." };
  const elapsedDays = journey.elapsedDays + 1;
  const daysRemaining = journey.daysRemaining - 1;
  const minute = state.minute + 1440;
  const segmentNow = journey.route[journey.segmentIndex]!;
  // Ребёнок без взрослых: каждый день в пути что-то может случиться.
  if (journey.alone) {
    const r = roll(`${minute}:${state.lifeId ?? state.playerName}:road`);
    // Сбежавшего ищут: в первые дни его могут найти и вернуть домой.
    if (journey.runawayFrom && elapsedDays <= 3 && r < 0.18) {
      const home = journey.runawayFrom;
      const message = `На ${elapsedDays}-й день вас находят люди, которых послала семья, и ведут обратно домой. Побег не удался.`;
      const back = advanceCharacterAge({ ...state, minute, settlementId: home, playerLocation: settlementGateLocationId(home), journey: undefined }, 1440);
      return { state: recordTravel(back, minute, message, home), ok: true, arrived: false, message };
    }
    const hazard = { low: 0.04, moderate: 0.08, high: 0.14 }[segmentNow.danger];
    const h = roll(`${minute}:${state.lifeId ?? state.playerName}:hazard`);
    if (h < hazard) {
      const lost = Math.ceil(state.money / 2);
      const message = lost > 0
        ? `Ночью у дороги вас обирают чужие люди: пропадает ${lost} монет. Вы целы, но напуганы.`
        : "Ночью вы мёрзнете у дороги, голодный и один. Утром идёте дальше, но день потерян.";
      const hurt = advanceCharacterAge({ ...state, minute, money: state.money - lost, journey: { ...journey, elapsedDays, daysRemaining: lost > 0 ? daysRemaining : journey.daysRemaining } }, 1440);
      return { state: recordTravel(hurt, minute, message, `route:${segmentNow.from}->${segmentNow.to}`), ok: true, arrived: false, message };
    }
  }
  if (daysRemaining > 0) {
    const message = `Прошёл ещё один день дороги. До следующего пункта пути осталось ${daysRemaining} дн.`;
    const next = advanceCharacterAge({ ...state, minute, journey: { ...journey, elapsedDays, daysRemaining } }, 1440);
    const segment = journey.route[journey.segmentIndex]!;
    return { state: recordTravel(next, minute, message, `route:${segment.from}->${segment.to}`), ok: true, arrived: false, message };
  }

  const reached = journey.route[journey.segmentIndex]!.to;
  const nextSegment = journey.segmentIndex + 1;
  if (nextSegment < journey.route.length && isRouteSeasonallyClosed(journey.route[nextSegment]!, minute)) {
    const message = "Следующий участок закрыт из-за зимних условий. Путешествие приостановлено до открытия дороги.";
    const paused = advanceCharacterAge({ ...state, minute, settlementId: reached, playerLocation: settlementGateLocationId(reached),
      journey: { ...journey, segmentIndex: nextSegment, daysRemaining: journey.route[nextSegment]!.days, elapsedDays } }, 1440);
    return { state: recordTravel(paused, minute, message, reached), ok: true, arrived: false, message };
  }
  const finalArrival = nextSegment >= journey.route.length;
  const nextJourney = finalArrival ? undefined : {
    ...journey,
    segmentIndex: nextSegment,
    daysRemaining: journey.route[nextSegment]!.days,
    elapsedDays
  };
  const next: GameState = advanceCharacterAge({
    ...state,
    minute,
    settlementId: reached,
    playerLocation: settlementGateLocationId(reached),
    journey: nextJourney
  }, 1440);
  const name = MAP_NODES.find(node => node.id === reached)?.name ?? reached;
  const message = finalArrival ? `Вы прибыли в ${name}. Путешествие завершено.` : `Вы достигли промежуточного пункта: ${name}. Следующий участок займёт ${nextJourney!.daysRemaining} дн.`;
  return {
    state: recordTravel(next, minute, message, reached),
    ok: true,
    arrived: finalArrival,
    message
  };
}

export function routeForSettlement(settlementId: string): Route[] {
  return ROUTES.filter(route => route.from === settlementId || route.to === settlementId);
}
