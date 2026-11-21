import { describe, expect, it } from "vitest";
import { createInitialState, npcLocation } from "../../engine/world";
import { validateWorld } from "../../engine/validate";
import { buildNpcContext, buildPlayerContext } from "../../engine/ai";
import { createVeloriaWorld } from "./world";
import { getChildAppearanceOptions, validateChildAppearance } from "./heritage";
import { attachGeneratedFamily, generateVeloriaFamily } from "./familyGeneration";
import { validateFamilyRecord } from "./family";
import type { VeloriaCharacterDraft } from "./character";

const draft = (familyState: VeloriaCharacterDraft["familyState"]): VeloriaCharacterDraft => ({
  name: "Ирина", age: 24, originId: "merchant-child", statusId: "guild-free", professionId: "merchant", familySeed: "roven-family-test-seed",
  familyState, startScenarioId: "ordinary", biography: "", attributes: {
    "Сила": 15, "Выносливость": 15, "Ловкость": 14, "Интеллект": 14, "Восприятие": 14, "Харизма": 14, "Воля": 14
  }
});

describe("Veloria generated family assignment", () => {
  it("creates two actual biological parent NPCs and a validated inherited appearance range", () => {
    const assignment = generateVeloriaFamily(draft("together"));
    expect(assignment.available).toBe(true);
    expect(assignment.biologicalParents).toHaveLength(2);
    expect(assignment.record?.biologicalParentage).toBe("both-known");
    expect(assignment.record?.biologicalParentIds).toHaveLength(2);
    expect(assignment.record?.legalParentage).toBe("unknown");
    expect(assignment.record?.parentalUnion?.status).toBe("unknown");
    const options = getChildAppearanceOptions(assignment.biologicalParents[0], assignment.biologicalParents[1]);
    expect(options.parentsKnown).toBe(true);
    if (options.parentsKnown && assignment.defaultAppearance) {
      expect(validateChildAppearance(assignment.biologicalParents[0]!, assignment.biologicalParents[1]!, assignment.defaultAppearance)).toEqual([]);
    }
  });
  it("is deterministic for the same character draft", () => {
    const first = generateVeloriaFamily(draft("together"));
    const second = generateVeloriaFamily(draft("together"));
    expect(first.members.map(member => [member.id, member.name, member.age])).toEqual(second.members.map(member => [member.id, member.name, member.age]));
    expect(first.defaultAppearance).toEqual(second.defaultAppearance);
  });
  it("keeps the same parent identities when only the family situation changes", () => {
    const together = generateVeloriaFamily(draft("together"));
    const distant = generateVeloriaFamily(draft("distant"));
    expect(distant.members.map(member => member.id)).toEqual(together.members.map(member => member.id));
    expect(distant.members.map(member => member.name)).toEqual(together.members.map(member => member.name));
  });
  it("does not change the family when the player changes their own name", () => {
    const original = generateVeloriaFamily(draft("together"));
    const renamed = generateVeloriaFamily({ ...draft("together"), name: "Новое имя" });
    expect(renamed.members.map(member => member.id)).toEqual(original.members.map(member => member.id));
    expect(renamed.members.map(member => member.name)).toEqual(original.members.map(member => member.name));
  });
  it("keeps the assigned biological family when the player changes social origin during draft editing", () => {
    const original = generateVeloriaFamily(draft("together"));
    const changedOrigin = generateVeloriaFamily({ ...draft("together"), originId: "free-farmer", statusId: "rural-free", professionId: "farmer" });
    expect(changedOrigin.members.map(member => member.id)).toEqual(original.members.map(member => member.id));
    expect(changedOrigin.members.map(member => member.name)).toEqual(original.members.map(member => member.name));
  });
  it("keeps the same family identity when only the player's age changes", () => {
    const younger = generateVeloriaFamily(draft("together"));
    const older = generateVeloriaFamily({ ...draft("together"), age: 40 });
    expect(older.members.map(member => member.id)).toEqual(younger.members.map(member => member.id));
    expect(older.members.map(member => member.name)).toEqual(younger.members.map(member => member.name));
    expect(older.members[0]?.age).toBeGreaterThan(younger.members[0]?.age ?? 0);
  });
  it("avoids NPC ID collisions when the same draft is added twice to one world", () => {
    const first = generateVeloriaFamily(draft("together"));
    const second = generateVeloriaFamily(draft("together"), first.members.map(member => member.id));
    expect(second.members.map(member => member.id)).not.toEqual(first.members.map(member => member.id));
    expect(second.members.map(member => member.name)).toEqual(first.members.map(member => member.name));
  });
  it("adds generated parents to the world as real NPCs", () => {
    const assignment = generateVeloriaFamily(draft("together"));
    const world = attachGeneratedFamily(createVeloriaWorld(), assignment);
    expect(validateWorld(world)).toEqual([]);
    for (const parentId of assignment.record!.biologicalParentIds) {
      expect(world.npcs[parentId]).toBeDefined();
      expect(world.npcs[parentId]?.familyRole).toBe("biological-parent");
      expect(world.npcs[parentId]?.appearance).toBeDefined();
    }
  });
  it("passes family knowledge to the AI and age/role data to parent NPC context", () => {
    const assignment = generateVeloriaFamily(draft("together"));
    const world = attachGeneratedFamily(createVeloriaWorld(), assignment);
    const state = createInitialState(world, "Ирина");
    state.playerProfile = {
      age: 24, originId: "merchant-child", statusId: "guild-free", professionId: "merchant",
      familyState: "together", startScenarioId: "ordinary", biography: "", attributes: {}, difficultyId: "balanced",
      familySummary: assignment.summary,
      heritage: assignment.record
    };
    const playerContext = buildPlayerContext(world, state);
    expect(playerContext.playerFamilySummary).toBe(assignment.summary);
    const parentContext = buildNpcContext(world, state, assignment.record!.biologicalParentIds[0]!);
    expect(parentContext?.npc.familyRole).toBe("biological-parent");
    expect(parentContext?.npc.playerRelationship).toBe("biological-parent");
    expect(parentContext?.playerFamilySummary).toBe(assignment.summary);
    expect(parentContext?.npc.age).toBeGreaterThan(0);
    const unrelatedContext = buildNpcContext(world, state, "marta");
    expect(unrelatedContext?.playerFamilySummary).toBeUndefined();
  });
  it("does not place missing parents in visible locations", () => {
    const assignment = generateVeloriaFamily(draft("lost"));
    const world = attachGeneratedFamily(createVeloriaWorld(), assignment);
    expect(validateWorld(world)).toEqual([]);
    for (const parentId of assignment.record!.biologicalParentIds) {
      expect(world.npcs[parentId]?.lifeStatus).toBe("missing");
      expect(npcLocation(world, parentId, 500)).toBeNull();
    }
  });
  it("records parental marriage separately without inferring legal recognition", () => {
    const assignment = generateVeloriaFamily({ ...draft("together"), parentalUnionStatus: "married" });
    expect(assignment.record?.parentalUnion?.status).toBe("married");
    expect(assignment.record?.legalParentage).toBe("unknown");
    expect(assignment.record?.legalParentIds).toEqual([]);
    expect(assignment.record?.birthStatus).toBe("unknown");
  });
  it("keeps chosen guardians separate from unknown biological parentage", () => {
    const assignment = generateVeloriaFamily({ ...draft("chosen-family"), parentalUnionStatus: "married" });
    expect(assignment.record?.parentalUnion?.status).toBe("unknown");
    expect(assignment.record?.biologicalParentage).toBe("unknown");
    expect(assignment.record?.biologicalParentIds).toEqual([]);
    expect(assignment.record?.guardianIds).toHaveLength(2);
    expect(assignment.record?.legalParentage).toBe("unknown");
    expect(assignment.record?.birthStatus).toBe("unknown");
  });
  it("keeps temple orphan parentage unknown and records the institution as guardian", () => {
    const assignment = generateVeloriaFamily({ ...draft("unknown"), originId: "temple-orphan", statusId: "temple", professionId: "healer-assistant" });
    expect(assignment.available).toBe(true);
    expect(assignment.record?.biologicalParentIds).toEqual([]);
    expect(assignment.record?.guardianIds).toContain("institution:sevenfold-temple");
  });
  it("blocks noble heir and bastard roles until real canonical parents and law can be assigned", () => {
    for (const originId of ["minor-heir", "noble-younger", "acknowledged-bastard", "impoverished-noble"] as const) {
      expect(generateVeloriaFamily({ ...draft("together"), originId }).available).toBe(false);
    }
  });
  it("rejects a temple orphan paired with a living biological family scenario", () => {
    const assignment = generateVeloriaFamily({ ...draft("together"), originId: "temple-orphan", statusId: "temple", professionId: "healer-assistant" });
    expect(assignment.available).toBe(false);
  });
});


describe("second-prince canonical family", () => {
  it("keeps the father, mother, recognition and succession as separate facts", () => {
    const result = generateVeloriaFamily({
      name: "Эдрен", age: 0, originId: "acknowledged-bastard", statusId: "noble", professionId: "none",
      familyState: "together", startScenarioId: "ordinary", parentalUnionStatus: "unmarried", dynasticRole: "second-prince",
      biography: "", attributes: { "Сила": 15, "Выносливость": 15, "Ловкость": 14, "Интеллект": 14, "Восприятие": 14, "Харизма": 14, "Воля": 14 }
    });
    expect(result.available).toBe(true);
    expect(result.record?.biologicalParentIds).toEqual(["rey-consort", "rey-second-prince-mother"]);
    expect(result.record?.legalParentIds).toEqual(["rey-consort"]);
    expect(result.record?.birthStatus).toBe("acknowledged");
    expect(result.record?.succession.status).toBe("eligible");
    expect(validateFamilyRecord(result.record!)).toEqual([]);
    expect(result.defaultAppearance).toMatchObject({ skinTone: 3, hairColor: "light-blond", eyeColor: "dark-brown", facialFeatures: "east-asian" });
  });
});
