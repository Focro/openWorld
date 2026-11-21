import { describe, expect, it } from "vitest";
import { buildNpcContext, buildNpcDialogueEnvelope } from "./ai";
import { advanceNpcPsychology, deriveNpcPersonality, learnNpcHabit, GUARDED_HEIR_TEMPLATE } from "./personality";
import { applyAction } from "./rules";
import { createInitialState, defaultWorld } from "./world";
import { createVeloriaWorld } from "../worlds/veloria/world";

describe("NPC personality and long-term psychology", () => {
  it("derives a stable, role-shaped personality instead of rerolling random traits", () => {
    const guard = { ...defaultWorld.npcs.vilem!, roleTags: ["guard"] as Array<"guard"> };
    const first = deriveNpcPersonality(guard);
    const second = deriveNpcPersonality(guard);
    expect(first).toEqual(second);
    expect(first.traits.discipline).toBeGreaterThan(60);
  });

  it("can represent a guarded heir without assigning that example to an existing canon NPC", () => {
    expect(GUARDED_HEIR_TEMPLATE.traits.warmth).toBeLessThan(30);
    expect(GUARDED_HEIR_TEMPLATE.copingPatterns.join(" ")).toContain("неловко");
    expect(createVeloriaWorld().npcs["guarded-heir-example"]).toBeUndefined();
  });

  it("uses authored personalities for named Veloria characters", () => {
    const world = createVeloriaWorld();
    expect(deriveNpcPersonality(world.npcs.orn!).temperament).toContain("упрямый");
    expect(deriveNpcPersonality(world.npcs.sister_alen!).traits.empathy).toBeGreaterThan(80);
    expect(deriveNpcPersonality(world.npcs.sergeant!).traits.discipline).toBeGreaterThan(85);
  });

  it("does not instantly rewrite stable temperament when a habit is learned", () => {
    const world = createVeloriaWorld();
    const state = createInitialState(world);
    const before = deriveNpcPersonality(world.npcs.marta!);
    const learned = learnNpcHabit(state, "marta", { id: "tea-after-work", label: "пьёт чай после смены", trigger: "окончание смены", strength: 30 });
    expect(deriveNpcPersonality(world.npcs.marta!)).toEqual(before);
    expect(learned.npcPsychology?.marta?.habits.some(habit => habit.id === "tea-after-work")).toBe(true);
  });

  it("gradually develops familiarity between NPCs who repeatedly share a place", () => {
    const world = createVeloriaWorld();
    const state = createInitialState(world);
    const next = advanceNpcPsychology(world, state, 1440);
    expect(next.npcBonds?.marta?.elric?.familiarity).toBeGreaterThan(0);
    expect(next.npcBonds?.elric?.marta?.sharedEncounters).toBe(next.npcBonds?.marta?.elric?.sharedEncounters);
    expect(next.chronicle.some(event => event.text.includes("Марта Вейл") && event.text.includes("Элрик Данн"))).toBe(true);
    expect(next.npcMemory.marta?.some(memory => memory.text.includes("Элрик Данн"))).toBe(true);
  });

  it("simulates background NPC encounters chronologically across two 12-hour waits", () => {
    const world = createVeloriaWorld();
    let state = createInitialState(world);
    state = applyAction(world, state, { type: "wait", minutes: 720 }).state;
    state = applyAction(world, state, { type: "wait", minutes: 720 }).state;
    const minutes = state.chronicle.map(event => event.minute);
    expect(minutes).toEqual([...minutes].sort((a, b) => a - b));
    expect(new Set(state.chronicle.map(event => event.id)).size).toBe(state.chronicle.length);
    expect(state.npcPsychology?.marta?.lastSimulationMinute).toBe(state.minute);
  });

  it("turns repeated NPC encounters into a gradually learned social habit", () => {
    const world = createVeloriaWorld();
    const state = createInitialState(world);
    const afterThreeDays = advanceNpcPsychology(world, state, 3 * 1440);
    expect(afterThreeDays.npcPsychology?.marta?.habits.some(habit => habit.id === "social-familiarity-elric")).toBe(true);
  });

  it("gives each NPC their own personality, habits and social circle in AI context", () => {
    const world = createVeloriaWorld();
    const state = advanceNpcPsychology(world, createInitialState(world), 1440);
    const context = buildNpcContext(world, state, "marta");
    expect(context?.personality.summary).toContain("тёплая");
    expect(context?.habits.length).toBeGreaterThan(0);
    expect(context?.socialCircle.some(person => person.npcId === "elric")).toBe(true);
    const envelope = buildNpcDialogueEnvelope(context!, "Почему ты мне не доверяешь?");
    expect(envelope.protocol).toBe("openworld-npc-dialogue-v1");
    expect(envelope.systemInstructions.join(" ")).toContain("постепенно");
  });
});
