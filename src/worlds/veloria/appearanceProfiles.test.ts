import { describe, expect, it } from "vitest";
import { createVeloriaWorld, VELORIA_WORLD } from "./world";
import { createVeloriaWorldForCharacter, type VeloriaCharacterDraft } from "./character";

const draft: VeloriaCharacterDraft = {
  name: "Путник", age: 22, originId: "wanderer", statusId: "marginal", professionId: "none",
  familyState: "unknown", startScenarioId: "ordinary", biography: "", attributes: {
    "Сила": 15, "Выносливость": 15, "Ловкость": 15, "Интеллект": 15, "Восприятие": 15, "Харизма": 10, "Воля": 15
  }
};

describe("stable Roven NPC appearance profiles", () => {
  it("gives every named Roven NPC a stable starting appearance profile", () => {
    for (const npc of Object.values(VELORIA_WORLD.npcs)) {
      expect(npc.appearance).toBeDefined();
      expect(npc.appearance?.hairstyle.length).toBeGreaterThan(0);
      expect(npc.appearance?.clothing.length).toBeGreaterThan(0);
    }
  });
  it("keeps NPC biological identity locked after creating a campaign world", () => {
    const world = createVeloriaWorld();
    expect(Object.isFrozen(world.npcs.marta?.appearance?.identity)).toBe(true);
    expect(Object.isFrozen(world.npcs.orn?.appearance?.identity)).toBe(true);
  });
  it("preserves stable profiles when a character-specific world is created", () => {
    const world = createVeloriaWorldForCharacter(draft);
    expect(world?.npcs.marta?.appearance?.identity.naturalHairColor).toBe("тёмно-каштановые");
    expect(Object.isFrozen(world?.npcs.marta?.appearance?.identity)).toBe(true);
  });
});
