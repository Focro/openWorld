import type { GameEvent, GameState } from "../../engine/types";
import { advanceCharacterAge } from "../../engine/lifecycle";
import { dayOfYear } from "../../engine/time";
import { MAP_NODES, ROUTES } from "./atlas";
import type { Route } from "./atlas";
import { settlementGateLocationId } from "./settlementMaps";
import { heroAgeYears } from "../../engine/speech";

/** Младше этого возраста одного в дальнюю дорогу не отпустят и никто не возьмёт. */
export const MIN_SOLO_TRAVEL_AGE = 14;
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

export function findVeloriaRoute(from: string, to: string, minute = 0): RoutePlan | null {
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

export function beginVeloriaJourney(state: GameState, destinationId: string): { state: GameState; message: string; ok: boolean } {
  if (state.lifeStatus === "dead") return { state, ok: false, message: "Путешествие невозможно: жизнь этого персонажа завершена." };
  if (state.journey) return { state, ok: false, message: "Вы уже находитесь в пути. Сначала завершите начатое путешествие." };
  const from = state.settlementId ?? "roven";
  const gateLocationId = settlementGateLocationId(from);
  if (state.playerLocation !== gateLocationId) {
    const gateName = from === "roven" ? "Южных ворот" : "местных ворот или пристани";
    return { state, ok: false, message: `Чтобы покинуть поселение, сначала доберитесь до ${gateName}. Путь проходит через местные улицы.` };
  }
  const plan = findVeloriaRoute(from, destinationId, state.minute);
  if (!plan || !plan.segments.length) return { state, ok: false, message: "Маршрут не найден или вы уже находитесь в этом поселении." };
  // Правдоподобие: ребёнок один в путь не уйдёт, а корабль и речная лодка стоят денег.
  const age = heroAgeYears(state);
  if (age !== undefined && age < MIN_SOLO_TRAVEL_AGE) return { state, ok: false, message: `Вам ${age < 1 ? "меньше года" : `${age}`}${age >= 1 ? (age % 10 === 1 && age % 100 !== 11 ? " год" : [2, 3, 4].includes(age % 10) && ![12, 13, 14].includes(age % 100) ? " года" : " лет") : ""}. Одного ребёнка в дальнюю дорогу не отпустят, и ни возчик, ни корабельщик его не возьмут.` };
  const fare = routeFare(plan.segments);
  if (fare > state.money) return { state, ok: false, message: `Место на судне на весь путь стоит около ${fare} монет, а у вас ${state.money}. Пешком туда не дойти.` };
  const first = plan.segments[0]!;
  const next: GameState = { ...state, money: state.money - fare, journey: { destinationId, route: plan.segments, segmentIndex: 0, daysRemaining: first.days, elapsedDays: 0 } };
  const message = `Вы отправляетесь из ${MAP_NODES.find(n => n.id === from)?.name ?? from}.${fare ? ` За место на судне отдано ${fare} монет.` : ""} Путь займёт около ${plan.totalDays} дней; опасность маршрута: ${plan.danger === "low" ? "низкая" : plan.danger === "moderate" ? "умеренная" : "высокая"}.`;
  return { state: recordTravel(next, state.minute, message, `route:${first.from}->${first.to}`), ok: true, message };
}

/** Продвигает путешествие ровно на один день. Игрок не переносится сразу в пункт назначения. */
export function advanceVeloriaJourney(state: GameState): { state: GameState; message: string; arrived: boolean; ok: boolean } {
  if (state.lifeStatus === "dead") return { state, ok: false, arrived: false, message: "Путь этого персонажа завершён вместе с его жизнью." };
  const journey = state.journey;
  if (!journey) return { state, ok: false, arrived: false, message: "Вы сейчас не путешествуете." };
  const elapsedDays = journey.elapsedDays + 1;
  const daysRemaining = journey.daysRemaining - 1;
  const minute = state.minute + 1440;
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
