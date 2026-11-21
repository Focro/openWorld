/**
 * Единый поток времени: запланированные события мира + развитие персонажа + возраст.
 *
 * Время режется на отрезки по запланированным событиям, чтобы ни одно событие
 * (рождение, смерть, коронация) не было «перепрыгнуто»: развитие доводится до
 * минуты события, событие применяется, затем время идёт дальше.
 */
import type { GameEvent, GameState, ScheduledWorldEvent, WorldData } from "./types";
import { advanceDevelopment, applyLossOfAttachment, memoryFraming, type DevelopmentNotice } from "./development";
import { npcsAt } from "./world";
import { advanceCharacterAge } from "./lifecycle";

export interface TimeAdvance {
  state: GameState;
  events: GameEvent[];
  notices: DevelopmentNotice[];
}

/** События мира, которые наступят в интервале (from, to] и ещё не обработаны. */
export function pendingWorldEvents(world: WorldData, state: GameState, toMinute: number): ScheduledWorldEvent[] {
  const done = new Set(state.processedWorldEvents ?? []);
  return (world.scheduledEvents ?? [])
    .filter(event => !done.has(event.id) && event.minute > state.minute - 1 && event.minute <= toMinute)
    .sort((a, b) => a.minute - b.minute || a.id.localeCompare(b.id));
}

/** Ближайшее ещё не случившееся событие мира после текущей минуты. */
export function nextWorldEvent(world: WorldData, state: GameState): ScheduledWorldEvent | undefined {
  const done = new Set(state.processedWorldEvents ?? []);
  return (world.scheduledEvents ?? []).filter(e => !done.has(e.id) && e.minute >= state.minute).sort((a, b) => a.minute - b.minute)[0];
}

function applyWorldEvent(world: WorldData, state: GameState, event: ScheduledWorldEvent): { state: GameState; chronicle: GameEvent } {
  const npcDeaths = event.npcDeathId ? { ...(state.npcDeaths ?? {}), [event.npcDeathId]: event.minute } : state.npcDeaths;
  // Свидетели — те, кто физически находится на месте события (умерший свидетелем не считается).
  const witnesses = npcsAt(world, event.minute, event.locationId, state.npcDeaths).filter(id => id !== event.npcDeathId);
  const chronicle: GameEvent = { id: `e${state.chronicle.length + 1}`, minute: event.minute, locationId: event.locationId, text: event.text, witnesses, source: { kind: "system" } };
  const npcMemory = { ...state.npcMemory };
  for (const id of witnesses) npcMemory[id] = [...(npcMemory[id] ?? []), { minute: event.minute, text: event.text, kind: "witnessed", confidence: 1, eventId: chronicle.id }];
  let development = state.development;
  if (development && event.npcDeathId && development.attachments[event.npcDeathId]) {
    development = applyLossOfAttachment(development, event.npcDeathId, world.npcs[event.npcDeathId]?.name ?? event.npcDeathId, event.minute);
  }
  // Игрок узнаёт о событии, если был рядом или если оно касается его дома (рождение, смерть близкого).
  const playerPresent = !state.journey && state.playerLocation === event.locationId;
  const concernsHousehold = Boolean(event.npcDeathId || event.npcBirthId);
  const playerMemory = [...state.playerMemory];
  if (playerPresent || concernsHousehold) {
    const framed = memoryFraming(development, event.text);
    playerMemory.push({ minute: event.minute, text: framed.text, kind: playerPresent ? "own" : "heard", confidence: playerPresent ? framed.confidence : Math.min(0.9, framed.confidence), eventId: chronicle.id });
  }
  return {
    state: {
      ...state, npcDeaths, npcMemory, playerMemory, development,
      chronicle: [...state.chronicle, chronicle],
      processedWorldEvents: [...(state.processedWorldEvents ?? []), event.id]
    },
    chronicle
  };
}

function advanceDevTo(world: WorldData, state: GameState, minute: number, notices: DevelopmentNotice[]): GameState {
  const result = advanceDevelopment(world, state, minute);
  if (!result) return state;
  notices.push(...result.notices);
  // Вехи развития фиксируются в личной памяти; ранние — с пометкой, что сознательно не помнятся.
  const playerMemory = [...state.playerMemory];
  for (const notice of result.notices.filter(n => n.important)) {
    const framed = memoryFraming(result.development, notice.text);
    playerMemory.push({ minute: notice.minute, text: framed.text, kind: "own", confidence: framed.confidence });
  }
  return { ...state, development: result.development, playerMemory };
}

/**
 * Продвигает «жизнь» от state.minute до targetMinute. Состояние state.minute
 * при входе — исходная минута; на выходе — targetMinute.
 */
export function advanceWorldTime(world: WorldData, state: GameState, targetMinute: number): TimeAdvance {
  if (targetMinute <= state.minute || state.lifeStatus === "dead") return { state, events: [], notices: [] };
  const startMinute = state.minute;
  const notices: DevelopmentNotice[] = [];
  const events: GameEvent[] = [];
  let current = state;
  for (const scheduled of pendingWorldEvents(world, state, targetMinute)) {
    current = advanceDevTo(world, current, scheduled.minute, notices);
    const applied = applyWorldEvent(world, { ...current, minute: Math.max(current.minute, scheduled.minute) }, scheduled);
    current = { ...applied.state, minute: current.minute };
    events.push(applied.chronicle);
  }
  current = advanceDevTo(world, current, targetMinute, notices);
  current = advanceCharacterAge({ ...current, minute: targetMinute }, targetMinute - startMinute);
  return { state: current, events, notices };
}
