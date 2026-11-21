import { describe, expect, it } from "vitest";
import { availableProfessions, availableScenarios, availableStatuses, resolveVeloriaStart, createVeloriaWorldForCharacter, type VeloriaCharacterDraft } from "./character";
import { attachGeneratedFamily, generateVeloriaFamily } from "./familyGeneration";

const attrs = { "Сила": 15, "Выносливость": 15, "Ловкость": 14, "Интеллект": 14, "Восприятие": 14, "Харизма": 14, "Воля": 14 };
const draft: VeloriaCharacterDraft = {
  name: "Ирина", age: 24, originId: "minor-heir", statusId: "noble",
  professionId: "squire", familyState: "together", startScenarioId: "ordinary",
  biography: "Младшая ветвь дома.", attributes: attrs
};

describe("Veloria character builder", () => {
  it("filters statuses and professions by origin", () => {
    expect(availableStatuses("minor-heir")).toEqual(["noble"]);
    expect(availableProfessions("minor-heir", "noble")).toContain("squire");
    expect(availableProfessions("minor-heir", "noble")).not.toContain("farmer");
    expect(availableProfessions("debt-runaway", "marginal")).toContain("laborer");
  });
  it("filters start scenarios by origin", () => {
    expect(availableScenarios("minor-heir")).toContain("exile");
    expect(availableScenarios("minor-heir")).not.toContain("debt-flight");
    expect(availableScenarios("caravan-hand")).toContain("captivity-escape");
  });
  it("creates the world at the Roven start location for the character", () => {
    const world = createVeloriaWorldForCharacter(draft);
    expect(world?.startLocationId).toBe("upper-street");
  });
  it("places a noble heir at upper street", () => {
    const result = resolveVeloriaStart(draft);
    expect(result.ok).toBe(true);
    if (result.ok) { expect(result.start.settlementId).toBe("roven"); expect(result.start.locationId).toBe("upper-street"); expect(result.start.money).toBe(35); }
  });
  it("places a temple orphan at the temple", () => {
    const result = resolveVeloriaStart({ ...draft, originId: "temple-orphan", statusId: "temple", professionId: "healer-assistant" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.start.locationId).toBe("temple");
  });
  it("rejects an incompatible status and profession", () => {
    const result = resolveVeloriaStart({ ...draft, statusId: "rural-free", professionId: "farmer" });
    expect(result.ok).toBe(false);
  });
  it("rejects an invalid attribute budget", () => {
    const result = resolveVeloriaStart({ ...draft, attributes: { ...attrs, "Сила": 30 } });
    expect(result.ok).toBe(false);
  });
  it("rejects implausible body measurements and unknown faiths", () => {
    expect(resolveVeloriaStart({ ...draft, heightCm: 170, weightKg: 120 }).ok).toBe(false);
    expect(resolveVeloriaStart({ ...draft, faithId: "not-a-faith" }).ok).toBe(false);
  });
  it("starts the canonical second prince at birth in the Koronholm palace", () => {
    const prince: VeloriaCharacterDraft = {
      ...draft, dynasticRole: "second-prince", name: "Эдрен", age: 0,
      originId: "acknowledged-bastard", statusId: "noble", professionId: "none",
      familyState: "together", startScenarioId: "ordinary", parentalUnionStatus: "unmarried",
      heightCm: 50, weightKg: 3.5
    };
    const result = resolveVeloriaStart(prince);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.start.settlementId).toBe("koronholm");
      expect(result.start.locationId).toBe("rey:royal-nursery");
    }
    const world = createVeloriaWorldForCharacter(prince);
    expect(world?.globalStartId).toBe("koronholm");
    expect(world?.startLocationId).toBe("rey:royal-nursery");
    expect(world?.npcs["rey-elin"]).toBeDefined();
    const assignment = generateVeloriaFamily(prince, Object.keys(world!.npcs));
    const completeWorld = attachGeneratedFamily(world!, assignment);
    expect(completeWorld.npcs["rey-second-prince-mother"]?.lifeStatus).toBe("alive");
  });
  it("keeps the second prince as a court NPC when the player chooses another origin", () => {
    const world = createVeloriaWorldForCharacter({ ...draft, age: 22, originId: "wanderer", statusId: "marginal", professionId: "none", dynasticRole: undefined });
    expect(world?.npcs["rey-second-prince"]).toBeDefined();
    expect(world?.npcs["rey-second-prince"]?.appearance).toBeDefined();
    expect(world?.npcs["rey-elin"]).toBeDefined();
  });
  it("rejects changing the second prince's birth age or parental union", () => {
    const prince: VeloriaCharacterDraft = {
      ...draft, dynasticRole: "second-prince", name: "Эдрен", age: 0,
      originId: "acknowledged-bastard", statusId: "noble", professionId: "none",
      familyState: "together", startScenarioId: "ordinary", parentalUnionStatus: "unmarried",
      heightCm: 50, weightKg: 3.5
    };
    expect(resolveVeloriaStart({ ...prince, age: 1 }).ok).toBe(false);
    expect(resolveVeloriaStart({ ...prince, parentalUnionStatus: "married" }).ok).toBe(false);
  });
  it("applies exile as a deterministic start", () => {
    const result = resolveVeloriaStart({ ...draft, startScenarioId: "exile" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.start.locationId).toBe("south-gate");
      expect(result.start.money).toBe(3);
      expect(result.start.inventory).toEqual({ plain_clothes: 1 });
    }
  });
});


describe("fixed Roven start", () => {
  it("keeps every ordinary origin inside Roven", async () => {
    const { VELORIA_START_SETTLEMENT_ID } = await import("./character");
    const { VELORIA_WORLD } = await import("./world");
    const origins = Object.keys({
      "minor-heir": 1, "noble-younger": 1, "acknowledged-bastard": 1, "impoverished-noble": 1,
      "craft-apprentice": 1, "independent-craftsman": 1, "merchant-child": 1, "small-trader": 1,
      "tenant-farmer": 1, "free-farmer": 1, "temple-orphan": 1, "temple-novice": 1,
      "former-soldier": 1, "caravan-hand": 1, "debt-runaway": 1, "wanderer": 1
    });
    const validLocations = new Set(Object.keys(VELORIA_WORLD.locations));
    for (const originId of origins) {
      const candidate = Object.entries({
        "minor-heir": ["noble", "squire"], "noble-younger": ["noble", "squire"],
        "acknowledged-bastard": ["noble", "scribe"], "impoverished-noble": ["noble", "none"],
        "craft-apprentice": ["serving", "apprentice"], "independent-craftsman": ["guild-free", "craftsman"],
        "merchant-child": ["guild-free", "merchant"], "small-trader": ["guild-free", "merchant"],
        "tenant-farmer": ["rural-free", "farmer"], "free-farmer": ["rural-free", "farmer"],
        "temple-orphan": ["temple", "healer-assistant"], "temple-novice": ["temple", "healer-assistant"],
        "former-soldier": ["serving", "soldier"], "caravan-hand": ["serving", "soldier"],
        "debt-runaway": ["marginal", "laborer"], "wanderer": ["marginal", "laborer"]
      }).find(([id]) => id === originId)?.[1];
      const scenario = originId === "debt-runaway" ? "debt-flight" : "ordinary";
      const result = resolveVeloriaStart({
        name: "Путник", age: 24, originId: originId as VeloriaCharacterDraft["originId"],
        statusId: candidate![0] as VeloriaCharacterDraft["statusId"],
        professionId: candidate![1] as VeloriaCharacterDraft["professionId"],
        familyState: "unknown", startScenarioId: scenario,
        biography: "Биография для проверки старта.", attributes: attrs
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.start.settlementId).toBe(VELORIA_START_SETTLEMENT_ID);
        expect(validLocations.has(result.start.locationId)).toBe(true);
        expect(result.start.locationId).not.toBe("mill-road");
      }
    }
  });
});
