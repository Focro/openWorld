import { describe, expect, it } from "vitest";
import { createInitialState, defaultWorld } from "./world";
import {
  chooseAfterDeath, createSuccessorInSameWorld, endCharacterLife,
  finalizeDeath, livingCharacter, advanceCharacterAge, MINUTES_PER_YEAR
} from "./lifecycle";
import { applyAction } from "./rules";

describe("character age and death", () => {
  it("ages only after a full year of elapsed game time", () => {
    const state = { ...createInitialState(defaultWorld), playerProfile: { age: 24, originId: "wanderer", statusId: "marginal", professionId: "none", familyState: "unknown", startScenarioId: "ordinary", biography: "", attributes: {}, difficultyId: "balanced" as const } };
    const almost = advanceCharacterAge(state, MINUTES_PER_YEAR - 1);
    expect(almost.playerProfile?.age).toBe(24);
    const birthday = advanceCharacterAge(almost, 1);
    expect(birthday.playerProfile?.age).toBe(25);
    expect(birthday.playerMemory.at(-1)?.text).toContain("25 лет");
  });
});

describe("character death and successor", () => {
  it("makes death terminal and does not overwrite the first death record", () => {
    const first = endCharacterLife(livingCharacter(), { minute: 100, cause: "казнь", locationId: "square", witnessedBy: ["guard", "guard"] });
    expect(first.status).toBe("dead");
    expect(first.death?.witnessedBy).toEqual(["guard"]);
    const second = endCharacterLife(first, { minute: 200, cause: "другая причина", locationId: "gate", witnessedBy: [] });
    expect(second).toBe(first);
  });

  it("prevents further actions after a confirmed death and records only valid witnesses", () => {
    const world = structuredClone(defaultWorld);
    const state = createInitialState(world, "Умерший");
    const dead = finalizeDeath(world, state, { minute: 10, cause: "казнь", locationId: "square", witnessedBy: ["invalid-npc"] });
    const result = applyAction(world, dead, { type: "look" });
    expect(result.ok).toBe(false);
    expect(result.state).toBe(dead);
    expect(result.message).toContain("завершена");
    expect(dead.chronicle.at(-1)?.text).toContain("казнь");
    expect(dead.deathRecord?.witnessedBy).toEqual([]);
  });

  it("starts a different character in the same world without resetting world history", () => {
    const world = structuredClone(defaultWorld);
    const previous = createInitialState(world, "Старый герой");
    const withHistory = { ...previous, minute: 1234, journey: { destinationId: "roven", route: [], segmentIndex: 0, daysRemaining: 1, elapsedDays: 0 }, playerProfile: { age: 80, originId: "wanderer", statusId: "marginal", professionId: "none", familyState: "unknown", startScenarioId: "ordinary", biography: "", attributes: {}, difficultyId: "balanced" as const }, chronicle: [{ id: "event-1", minute: 100, locationId: "square", text: "Старое событие", witnesses: [], source: { kind: "system" as const } }] };
    const death = { minute: 1200, cause: "старость", locationId: "square", witnessedBy: [] };
    const dead = finalizeDeath(world, withHistory, death);
    const life = endCharacterLife(livingCharacter(), death);
    const next = createSuccessorInSameWorld(world, dead, life, { name: "Новый герой", startLocationId: "square", money: 3, inventory: { clothes: 1 } });
    expect(next?.playerName).toBe("Новый герой");
    expect(next?.minute).toBe(1234);
    expect(next?.chronicle.length).toBe(withHistory.chronicle.length + 1);
    expect(next?.playerMemory).toHaveLength(1);
    expect(next?.money).toBe(3);
    expect(next?.lifeStatus).toBe("alive");
    expect(next?.journey).toBeUndefined();
    expect(next?.playerProfile).toBeUndefined();
  });

  it("initializes memory for newly generated family NPCs when a successor enters the world", () => {
    const originalWorld = structuredClone(defaultWorld);
    const previous = createInitialState(originalWorld, "Старый герой");
    const death = { minute: 10, cause: "старость", locationId: "square", witnessedBy: [] };
    const dead = finalizeDeath(originalWorld, previous, death);
    const life = endCharacterLife(livingCharacter(), death);
    const expandedWorld = { ...originalWorld, npcs: { ...originalWorld.npcs, generatedParent: {
      id: "generatedParent", name: "Эдрен Норрен", homeId: "square", roleTags: ["commoner" as const], goals: [], schedule: [], lifeStatus: "alive" as const, familyRole: "biological-parent" as const
    } } };
    const next = createSuccessorInSameWorld(expandedWorld, dead, life, { name: "Преемник", startLocationId: "square", money: 0, inventory: {} });
    expect(next?.npcMemory.generatedParent).toEqual([]);
    expect(next?.relations.generatedParent).toBeDefined();
  });

  it("does not allow same-world continuation before death or invalid spawn", () => {
    const world = structuredClone(defaultWorld);
    const state = createInitialState(world);
    const death = { minute: 1, cause: "тест", locationId: "square", witnessedBy: [] };
    const life = endCharacterLife(livingCharacter(), death);
    expect(createSuccessorInSameWorld(world, state, livingCharacter(), { name: "Новый", startLocationId: "square", money: 0, inventory: {} })).toBeNull();
    const dead = finalizeDeath(world, state, death);
    expect(createSuccessorInSameWorld(world, dead, life, { name: "Новый", startLocationId: "unknown", money: 0, inventory: {} })).toBeNull();
  });

  it("keeps the two post-death choices distinct", () => {
    expect(chooseAfterDeath("same-world-new-character")).toBe("same-world-new-character");
    expect(chooseAfterDeath("new-world")).toBe("new-world");
  });
});


describe("second-prince birth timeline", () => {
  it("records the mother's death in 725 KL through the world timeline and stops her presence", async () => {
    const { npcLocation } = await import("./world");
    const { advanceWorldTime } = await import("./timeflow");
    const { startVeloriaCampaign } = await import("../worlds/veloria/campaign");
    const draft = { name: "Эдрен", age: 0, originId: "acknowledged-bastard" as const, statusId: "noble" as const, professionId: "none" as const, familyState: "together" as const, startScenarioId: "ordinary" as const, parentalUnionStatus: "unmarried" as const, dynasticRole: "second-prince" as const, biography: "", attributes: { "Сила": 15, "Выносливость": 15, "Ловкость": 14, "Интеллект": 14, "Восприятие": 14, "Харизма": 14, "Воля": 14 } };
    const started = startVeloriaCampaign({ kind: "veloria-character", draft, difficultyId: "balanced" });
    if (!started.ok) throw new Error(started.errors.join(" "));
    const { world, state } = started;
    expect(npcLocation(world, "rey-second-prince-mother", state.minute, state.npcDeaths)).toBe("rey:royal-nursery");
    const after = advanceWorldTime(world, state, state.minute + 2 * 365 * 1440).state;
    expect(after.playerProfile?.age).toBe(2);
    expect(after.npcDeaths?.["rey-second-prince-mother"]).toBeDefined();
    expect(npcLocation(world, "rey-second-prince-mother", after.minute, after.npcDeaths)).toBeNull();
    expect(after.chronicle.some(event => event.text.includes("мать второго принца умерла") && event.text.includes("Причина смерти не установлена"))).toBe(true);
    // Повторное продвижение времени не создаёт второе событие смерти.
    const later = advanceWorldTime(world, after, after.minute + 30 * 1440).state;
    expect(later.chronicle.filter(event => event.text.includes("мать второго принца умерла"))).toHaveLength(1);
  });
});
