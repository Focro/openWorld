import type { DeathRecord, GameState, WorldData } from "./types";
import { neutralRelation } from "./relations";

/** Смерть закрывает историю конкретного героя; новая жизнь означает другого персонажа. */
export interface CharacterLifeState {
  status: "alive" | "dead";
  death: DeathRecord | null;
}
export interface SuccessorCharacter {
  name: string;
  startLocationId: string;
  money: number;
  inventory: Record<string, number>;
}
export type AfterDeathChoice = "same-world-new-character" | "new-world";

export const livingCharacter = (): CharacterLifeState => ({ status: "alive", death: null });

export const MINUTES_PER_YEAR = 365 * 24 * 60;

/** Естественное старение: возраст растёт только от реально прошедшего игрового времени. */
export function advanceCharacterAge(state: GameState, elapsedMinutes: number): GameState {
  if (!state.playerProfile || state.lifeStatus === "dead" || !Number.isFinite(elapsedMinutes) || elapsedMinutes <= 0) return state;
  const previous = state.playerProfile.ageProgressMinutes ?? 0;
  const total = previous + Math.floor(elapsedMinutes);
  const birthdays = Math.floor(total / MINUTES_PER_YEAR);
  const remainder = total % MINUTES_PER_YEAR;
  if (birthdays <= 0 && remainder === previous) return state;
  const previousAge = state.playerProfile.age;
  const age = previousAge + birthdays;
  const profile = { ...state.playerProfile, age, ageProgressMinutes: remainder };
  const next: GameState = birthdays <= 0
    ? { ...state, playerProfile: profile }
    : { ...state, playerProfile: profile, playerMemory: [...state.playerMemory, { minute: state.minute, text: birthdays === 1 ? `Сегодня вам исполнилось ${age} лет.` : `Прошло несколько лет. Теперь вам ${age} лет.`, kind: "own", confidence: 1 }] };
  // Канонические события кампаний (смерть матери второго принца и т. п.) теперь
  // обрабатываются общим потоком времени: см. engine/timeflow.ts и WorldData.scheduledEvents.
  return next;
}

/** Необратимо закрывает текущую жизнь. Повторный вызов не меняет запись смерти. */
export function endCharacterLife(life: CharacterLifeState, death: DeathRecord): CharacterLifeState {
  if (life.status === "dead") return life;
  return { status: "dead", death: { ...death, witnessedBy: [...new Set(death.witnessedBy)] } };
}

/** Помечает игровое состояние завершённым для умершего героя. */
export function markGameStateDead(state: GameState, death: DeathRecord): GameState {
  if (state.lifeStatus === "dead") return state;
  return { ...state, lifeStatus: "dead", deathRecord: { ...death, witnessedBy: [...new Set(death.witnessedBy)] } };
}

/** Фиксирует смерть в объективной хронике и памяти только NPC-свидетелей. */
export function finalizeDeath(world: WorldData, state: GameState, death: DeathRecord): GameState {
  if (state.lifeStatus === "dead") return state;
  const witnessedBy = [...new Set(death.witnessedBy)].filter(id => Boolean(world.npcs[id]));
  const eventId = `e${state.chronicle.length + 1}`;
  const text = `${state.playerName} умер(ла): ${death.cause}.`;
  const event = {
    id: eventId, minute: death.minute, locationId: death.locationId,
    text, witnesses: witnessedBy, source: { kind: "system" as const }
  };
  const npcMemory = { ...state.npcMemory };
  for (const npcId of witnessedBy) {
    npcMemory[npcId] = [...(npcMemory[npcId] ?? []), {
      minute: death.minute, text, kind: "witnessed", confidence: 1, eventId
    }];
  }
  return {
    ...state,
    lifeStatus: "dead",
    deathRecord: { ...death, witnessedBy },
    chronicle: [...state.chronicle, event],
    npcMemory
  };
}

/**
 * Создаёт нового героя в том же продолжающемся мире.
 * Хроника и память NPC сохраняются; личная память, имущество и отношения умершего не наследуются.
 */
export function createSuccessorInSameWorld(
  world: WorldData,
  previousState: GameState,
  life: CharacterLifeState,
  successor: SuccessorCharacter
): GameState | null {
  if (life.status !== "dead" || !life.death || previousState.lifeStatus !== "dead") return null;
  if (!successor.name.trim() || !world.locations[successor.startLocationId]) return null;

  const relations = Object.fromEntries(Object.keys(world.npcs).map(id => [id, neutralRelation()]));
  return {
    ...previousState,
    playerName: successor.name.trim(),
    minute: previousState.minute,
    playerLocation: successor.startLocationId,
    settlementId: world.globalStartId,
    journey: undefined,
    playerProfile: undefined,
    money: successor.money,
    inventory: { ...successor.inventory },
    playerMemory: [{
      minute: previousState.minute,
      text: "Вы начинаете новую жизнь в мире, где уже произошли события прошлой эпохи.",
      kind: "own",
      confidence: 1
    }],
    npcMemory: Object.fromEntries(Object.keys(world.npcs).map(id => [id, previousState.npcMemory[id] ?? []])),
    npcAppearanceObservations: {},
    appearanceObservations: {},
    npcAppearances: previousState.npcAppearances,
    relations,
    lifeStatus: "alive",
    deathRecord: undefined,
    socialState: { suspicion: 0, heresySuspicion: 0, claimCount: 0, cultAttempts: 0, followers: [], movement: "none", legalCase: "none" }
  };
}

/** Новый мир должен создаваться отдельным генератором; старое состояние сюда не переносится. */
export function chooseAfterDeath(choice: AfterDeathChoice): AfterDeathChoice {
  return choice;
}
