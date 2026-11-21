import type { NpcBond, NpcDef, NpcHabit, NpcPersonality, NpcPsychology, PersonalityTraits, GameState, WorldData } from "./types";
import { activeSchedule, npcExistsAt, npcLocation } from "./world";

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));
const DEFAULT_TRAITS: PersonalityTraits = {
  warmth: 50, sociability: 50, assertiveness: 50, emotionalReactivity: 50, patience: 50,
  openness: 50, discipline: 50, suspicion: 50, empathy: 50, pride: 50
};

/** Stable hash: generated NPC personalities never reroll between sessions or machines. */
function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return hash >>> 0;
}

/** Illustrative profile for a future authored heir; it is NOT attached to Veloria canon or an active NPC. */
export const GUARDED_HEIR_TEMPLATE: NpcPersonality = {
  temperament: "эмоционально сдержанный, привыкший держать дистанцию",
  traits: { warmth: 22, sociability: 30, assertiveness: 78, emotionalReactivity: 28, patience: 70, openness: 24, discipline: 86, suspicion: 68, empathy: 52, pride: 84 },
  values: ["долг", "самоконтроль", "достоинство"],
  formativeExperiences: ["В детстве получал мало тепла и одобрения; близость почти не выражалась в семье."],
  copingPatterns: ["на ласковые слова сначала отвечает сдержанно или неловко, даже если они ему приятны", "привык скрывать потребность в поддержке", "при устойчивом доверии постепенно учится принимать заботу и отвечать на неё"],
  initialHabits: [{ id: "guarded-response-to-affection", label: "не отвечает на нежность сразу", trigger: "личная нежность", strength: 70 }]
};

const ROLE_BASELINES: Record<string, Partial<PersonalityTraits>> = {
  guard: { assertiveness: 62, discipline: 78, suspicion: 66, patience: 52, pride: 58, empathy: 42 },
  clergy: { warmth: 66, patience: 72, empathy: 78, discipline: 66, sociability: 54, suspicion: 42 },
  healer: { warmth: 70, patience: 76, empathy: 86, emotionalReactivity: 42, assertiveness: 48 },
  merchant: { sociability: 70, openness: 60, discipline: 58, suspicion: 52, assertiveness: 56, patience: 54 },
  noble: { pride: 72, discipline: 66, assertiveness: 62, sociability: 54, suspicion: 58, warmth: 44 },
  commoner: { warmth: 54, sociability: 52, patience: 54, openness: 50 }
};

/**
 * A deterministic personality profile for generated NPCs. It is role-shaped, not random:
 * the id only introduces small stable differences so a whole town does not feel cloned.
 */
export function deriveNpcPersonality(npc: NpcDef): NpcPersonality {
  if (npc.personality) return npc.personality;
  const roles = npc.roleTags ?? ["commoner"];
  const primaryRole = roles.find(role => ROLE_BASELINES[role]) ?? "commoner";
  const baseline = { ...DEFAULT_TRAITS, ...ROLE_BASELINES[primaryRole] };
  const hash = stableHash(npc.id);
  const traits = Object.fromEntries((Object.keys(DEFAULT_TRAITS) as Array<keyof PersonalityTraits>).map((key, index) => {
    const offset = ((hash >>> (index * 3 % 24)) & 7) - 3;
    return [key, clamp(baseline[key] + offset * 2)];
  })) as unknown as PersonalityTraits;
  return {
    temperament: primaryRole === "guard" ? "сдержанный и настороженный" : primaryRole === "clergy" || primaryRole === "healer" ? "терпеливый и отзывчивый" : primaryRole === "merchant" ? "общительный и практичный" : primaryRole === "noble" ? "собранный и гордый" : "ровный, приспосабливающийся",
    traits,
    values: primaryRole === "guard" ? ["порядок", "надёжность"] : primaryRole === "merchant" ? ["самостоятельность", "честный расчёт"] : primaryRole === "clergy" || primaryRole === "healer" ? ["милосердие", "долг"] : ["безопасность", "достоинство"],
    formativeExperiences: [],
    copingPatterns: primaryRole === "guard" ? ["при опасности сначала оценивает угрозу"] : primaryRole === "merchant" ? ["при неопределённости ищет практическую выгоду"] : ["в непривычной ситуации сначала наблюдает"],
    initialHabits: npc.schedule.filter(entry => entry.activity).slice(0, 2).map((entry, i) => ({
      id: `routine-${i + 1}`, label: entry.activity!, trigger: `расписание:${entry.locationId}`, strength: 35
    }))
  };
}

export function createNpcPsychology(npc: NpcDef, minute: number): NpcPsychology {
  const profile = deriveNpcPersonality(npc);
  return {
    habits: profile.initialHabits.map(habit => ({ ...habit, repetitions: 1, lastReinforcedMinute: minute })),
    stress: 0,
    emotionalLoad: 0,
    lastSimulationMinute: minute
  };
}

export function createInitialNpcBonds(world: WorldData): Record<string, Record<string, NpcBond>> {
  return Object.fromEntries(Object.keys(world.npcs).map(id => [id, {}]));
}

function ensurePsychology(world: WorldData, state: GameState): Record<string, NpcPsychology> {
  return Object.fromEntries(Object.keys(world.npcs).map(id => [id, state.npcPsychology?.[id] ?? createNpcPsychology(world.npcs[id]!, state.minute)]));
}

function ensureBonds(world: WorldData, state: GameState): Record<string, Record<string, NpcBond>> {
  const base = createInitialNpcBonds(world);
  for (const [id, links] of Object.entries(state.npcBonds ?? {})) base[id] = { ...base[id], ...links };
  return base;
}

/** Reinforce routines over elapsed full days and let co-present NPCs gradually become familiar. */
export function advanceNpcPsychology(world: WorldData, state: GameState, elapsedMinutes: number): GameState {
  if (elapsedMinutes <= 0 || Object.keys(world.npcs).length === 0) return state;
  const psychology = ensurePsychology(world, state);
  const bonds = ensureBonds(world, state);
  const targetMinute = state.minute + elapsedMinutes;
  const lastSimulatedMinute = Math.min(...Object.values(psychology).map(item => item.lastSimulationMinute));
  const completedDays = Math.floor((targetMinute - lastSimulatedMinute) / 1440);
  const backgroundEvents: import("./types").GameEvent[] = [];
  const npcMemory: GameState["npcMemory"] = { ...state.npcMemory };

  // Daily maintenance is separate from encounters, so two 12-hour waits correctly form one day.
  for (let day = 0; day < completedDays; day++) {
    const dayMinute = lastSimulatedMinute + (day + 1) * 1440;
    for (const npc of Object.values(world.npcs)) {
      const current = psychology[npc.id] ?? createNpcPsychology(npc, dayMinute);
      if (current.lastSimulationMinute >= dayMinute) continue;
      if (!npcExistsAt(world, npc.id, dayMinute, state.npcDeaths)) { psychology[npc.id] = { ...current, lastSimulationMinute: dayMinute }; continue; }
      const habits = current.habits.map(habit => ({ ...habit, strength: clamp(habit.strength - 1) }));
      for (const entry of activeSchedule(npc, dayMinute)) {
        if (!entry.activity) continue;
        const existing = habits.find(h => h.trigger === `расписание:${entry.locationId}`);
        if (existing) {
          existing.strength = clamp(existing.strength + 2);
          existing.repetitions += 1;
          existing.lastReinforcedMinute = dayMinute;
        } else {
          habits.push({ id: `learned-${stableHash(`${npc.id}:${entry.locationId}`).toString(36)}`, label: entry.activity, trigger: `расписание:${entry.locationId}`, strength: 20, repetitions: 1, lastReinforcedMinute: dayMinute });
        }
      }
      psychology[npc.id] = {
        ...current, habits: habits.filter(h => h.strength > 0).slice(0, 12),
        stress: clamp(current.stress - 2), emotionalLoad: clamp(current.emotionalLoad - 2), lastSimulationMinute: dayMinute
      };
    }
  }

  // Simulate only encounters whose timestamps fall inside this exact elapsed interval.
  // This keeps the world chronicle chronological even when the player advances time in small steps.
  const sampleHours = [12, 18, 21];
  const firstCalendarDay = Math.floor(state.minute / 1440) * 1440;
  const lastCalendarDay = Math.floor(targetMinute / 1440) * 1440;
  for (let calendarDay = firstCalendarDay; calendarDay <= lastCalendarDay; calendarDay += 1440) {
    for (const hour of sampleHours) {
      const sampleMinute = calendarDay + hour * 60;
      if (sampleMinute <= state.minute || sampleMinute > targetMinute) continue;
      const groups = new Map<string, string[]>();
      for (const id of Object.keys(world.npcs).sort()) {
        const location = npcLocation(world, id, sampleMinute, state.npcDeaths);
        if (location) groups.set(location, [...(groups.get(location) ?? []), id]);
      }
      for (const [locationId, ids] of groups) {
        for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
          const a = ids[i]!, b = ids[j]!;
          const left = bonds[a]?.[b] ?? { familiarity: 0, trust: 0, warmth: 0, tension: 0, sharedEncounters: 0, lastEncounterMinute: 0 };
          if (left.lastEncounterMinute > 0 && Math.floor(left.lastEncounterMinute / 1440) === Math.floor(sampleMinute / 1440)) continue;
          const leftTraits = deriveNpcPersonality(world.npcs[a]!).traits;
          const rightTraits = deriveNpcPersonality(world.npcs[b]!).traits;
          const encounterCount = left.sharedEncounters + 1;
          const nextLeft: NpcBond = {
            ...left,
            familiarity: clamp(left.familiarity + 1), sharedEncounters: encounterCount, lastEncounterMinute: sampleMinute,
            warmth: clamp(left.warmth + (encounterCount % 2 === 0 && leftTraits.warmth >= 60 && rightTraits.warmth >= 45 ? 1 : 0), -100, 100),
            tension: clamp(left.tension + (encounterCount % 3 === 0 && leftTraits.suspicion >= 70 && rightTraits.assertiveness >= 65 ? 1 : 0), -100, 100),
            trust: clamp(left.trust + (encounterCount % 4 === 0 && leftTraits.openness >= 55 && leftTraits.suspicion < 75 ? 1 : 0), -100, 100)
          };
          const rightPrevious = bonds[b]?.[a] ?? { ...left };
          const nextRight: NpcBond = {
            ...rightPrevious,
            familiarity: clamp(rightPrevious.familiarity + 1), sharedEncounters: encounterCount, lastEncounterMinute: sampleMinute,
            warmth: clamp(rightPrevious.warmth + (encounterCount % 2 === 0 && rightTraits.warmth >= 60 && leftTraits.warmth >= 45 ? 1 : 0), -100, 100),
            tension: clamp(rightPrevious.tension + (encounterCount % 3 === 0 && rightTraits.suspicion >= 70 && leftTraits.assertiveness >= 65 ? 1 : 0), -100, 100),
            trust: clamp(rightPrevious.trust + (encounterCount % 4 === 0 && rightTraits.openness >= 55 && rightTraits.suspicion < 75 ? 1 : 0), -100, 100)
          };
          bonds[a] = { ...(bonds[a] ?? {}), [b]: nextLeft };
          bonds[b] = { ...(bonds[b] ?? {}), [a]: nextRight };

          const coLocated = ids;
          const eventId = `e${state.chronicle.length + backgroundEvents.length + 1}`;
          const locationName = world.locations[locationId]?.name ?? locationId;
          const youngerThan3 = (id: string) => { const born = world.npcs[id]!.bornAtMinute; return born !== undefined && sampleMinute - born < 3 * 365 * 1440; };
          const talkative = !youngerThan3(a) && !youngerThan3(b) && (leftTraits.sociability + rightTraits.sociability) / 2 >= 45;
          // Хроника хранит знакомство и заметные этапы сближения, а не каждую рядовую встречу:
          // иначе за годы игрового времени она разрастается до сотен тысяч одинаковых записей.
          const notable = encounterCount === 1 || encounterCount === 10 || encounterCount === 50 || encounterCount % 200 === 0;
          if (notable) {
          const interactionText = talkative
            ? `${world.npcs[a]!.name} и ${world.npcs[b]!.name} обменялись несколькими словами в локации «${locationName}».`
            : `${world.npcs[a]!.name} и ${world.npcs[b]!.name} оказались рядом в локации «${locationName}», каждый занимаясь своим делом.`;
          backgroundEvents.push({
            id: eventId, minute: sampleMinute, locationId, text: interactionText,
            witnesses: coLocated, source: { kind: "npc", id: a }, routine: true
          });
          for (const witnessId of coLocated) {
            npcMemory[witnessId] = [...(npcMemory[witnessId] ?? []), { minute: sampleMinute, text: interactionText, kind: "witnessed", confidence: 1, eventId }];
          }
          }
          if (encounterCount >= 3) {
            for (const [ownerId, otherId] of [[a, b], [b, a]] as const) {
              const owner = psychology[ownerId]!;
              const habitId = `social-familiarity-${otherId}`;
              const existingHabit = owner.habits.find(habit => habit.id === habitId);
              if (existingHabit) {
                existingHabit.strength = clamp(existingHabit.strength + 2);
                existingHabit.repetitions += 1;
                existingHabit.lastReinforcedMinute = sampleMinute;
              } else {
                owner.habits.push({ id: habitId, label: `привык к регулярным встречам с ${world.npcs[otherId]!.name}`, trigger: `регулярные встречи:${otherId}`, strength: 25, repetitions: 1, lastReinforcedMinute: sampleMinute });
              }
              psychology[ownerId] = { ...owner, habits: owner.habits.slice(-12) };
            }
          }
        }
      }
    }
  }

  return {
    ...state, npcPsychology: psychology, npcBonds: bonds,
    chronicle: [...state.chronicle, ...backgroundEvents], npcMemory
  };
}

export function describePersonality(profile: NpcPersonality): string {
  const t = profile.traits;
  const dimensions = [
    t.warmth >= 65 ? "тёплый" : t.warmth <= 35 ? "эмоционально сдержанный" : "умеренно тёплый",
    t.sociability >= 65 ? "общительный" : t.sociability <= 35 ? "замкнутый" : "избирательный в общении",
    t.assertiveness >= 65 ? "напористый" : t.assertiveness <= 35 ? "уступчивый" : "умеет отстаивать своё",
    t.patience >= 65 ? "терпеливый" : t.patience <= 35 ? "нетерпеливый" : "умеренно терпеливый",
    t.suspicion >= 65 ? "настороженный" : t.suspicion <= 35 ? "доверчивый" : "осторожный"
  ];
  return `${profile.temperament}; ${dimensions.join(", ")}; ценит: ${profile.values.join(", ") || "не установлено"}.`;
}

export function learnNpcHabit(
  state: GameState, npcId: string, habit: Omit<NpcHabit, "repetitions" | "lastReinforcedMinute"> & { repetitions?: number }, minute = state.minute
): GameState {
  const current = state.npcPsychology?.[npcId];
  if (!current) return state;
  const habits = [...current.habits];
  const existing = habits.find(item => item.id === habit.id);
  if (existing) {
    existing.strength = clamp(existing.strength + Math.max(1, habit.strength * 0.08));
    existing.repetitions += 1;
    existing.lastReinforcedMinute = minute;
  } else {
    habits.push({ ...habit, strength: clamp(habit.strength), repetitions: habit.repetitions ?? 1, lastReinforcedMinute: minute });
  }
  return { ...state, npcPsychology: { ...state.npcPsychology, [npcId]: { ...current, habits: habits.slice(-12) } } };
}
