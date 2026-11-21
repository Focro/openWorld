import { describe, expect, it } from "vitest";
import { UPPER_SOCIETY_ROSTER, STATE_POLITICAL_STRUCTURES, START_ENTOURAGES, attachStartEntourage, describeStartEntourage, instantiateUpperSocietyNpc } from "./upperSociety";
import { createVeloriaWorld } from "./world";
import { VELORIA_ORIGIN_LABELS } from "./lore";
import { NOBLE_HOUSES } from "./nobleHouses";
import { buildKnowledgeIndex } from "../../engine/knowledge";

describe("Veloria upper society roster", () => {
  it("covers every named member of all 30 canonical houses", () => {
    expect(UPPER_SOCIETY_ROSTER).toHaveLength(NOBLE_HOUSES.reduce((sum, house) => sum + house.members.length, 0));
    expect(new Set(UPPER_SOCIETY_ROSTER.map(person => person.id)).size).toBe(UPPER_SOCIETY_ROSTER.length);
    expect(new Set(UPPER_SOCIETY_ROSTER.map(person => person.houseId)).size).toBe(48);
  });

  it("gives every currently confirmed living noble a stable personality profile", () => {
    const active = UPPER_SOCIETY_ROSTER.filter(person => person.availability === "active-canon");
    expect(active.length).toBeGreaterThan(80);
    for (const person of active) {
      expect(person.personality).toBeDefined();
      expect(person.personality?.temperament.length).toBeGreaterThan(8);
      for (const value of Object.values(person.personality!.traits)) expect(value).toBeGreaterThanOrEqual(0);
      for (const value of Object.values(person.personality!.traits)) expect(value).toBeLessThanOrEqual(100);
    }
  });

  it("does not claim every state is a monarchy", () => {
    expect(STATE_POLITICAL_STRUCTURES).toHaveLength(6);
    expect(STATE_POLITICAL_STRUCTURES.find(state => state.id === "tharvek")?.government).toContain("выборный");
    expect(STATE_POLITICAL_STRUCTURES.find(state => state.id === "varent")?.headOfState).toContain("Совет Лиги");
    expect(STATE_POLITICAL_STRUCTURES.find(state => state.id === "elyndor")?.headOfState).toContain("единого монарха нет");
  });

  it("does not invent a name for a state office absent from canon", () => {
    expect(STATE_POLITICAL_STRUCTURES.find(state => state.id === "tharvek")?.headOfState).toContain("имя в текущем каноне не задано");
    expect(STATE_POLITICAL_STRUCTURES.find(state => state.id === "varent")?.headOfState).toContain("не назван");
  });

  it("materializes a court NPC only when the character is confirmed alive", () => {
    const living = instantiateUpperSocietyNpc("rey-elin", "upper-street");
    // Титул зависит от даты: королевой Элиана становится только в 735 КЛ.
    expect(living?.personality?.temperament).toContain("735 КЛ");
    expect(living?.personality?.temperament).not.toMatch(/^королева/);
    expect(instantiateUpperSocietyNpc("rey-aldric", "upper-street")).toBeNull();
  });

  it("indexes public court identities without leaking private temperament", () => {
    const index = buildKnowledgeIndex(createVeloriaWorld());
    expect(index.some(item => item.id === "upper-society:rey-elin")).toBe(true);
    expect(index.some(item => item.id === "upper-society:mar-nadir")).toBe(true);
    expect(index.filter(item => item.id.startsWith("upper-society:")).length).toBe(UPPER_SOCIETY_ROSTER.length);
    expect(index.filter(item => item.id.startsWith("upper-society:")).some(item => item.text.includes("темперамент"))).toBe(false);
  });
});

describe("origin-specific start entourage", () => {
  it("provides a different named starting cast for every origin", () => {
    expect(Object.keys(START_ENTOURAGES)).toHaveLength(Object.keys(VELORIA_ORIGIN_LABELS).length);
    for (const originId of Object.keys(VELORIA_ORIGIN_LABELS) as Array<keyof typeof VELORIA_ORIGIN_LABELS>) {
      expect(START_ENTOURAGES[originId].length).toBeGreaterThanOrEqual(2);
      expect(new Set(START_ENTOURAGES[originId].map(person => person.id)).size).toBe(START_ENTOURAGES[originId].length);
    }
  });

  it("attaches only the selected background's entourage to a campaign", () => {
    const world = attachStartEntourage(createVeloriaWorld(), "temple-orphan");
    expect(world.npcs["start-orphan-caretaker"]?.name).toBe("Дарья Невель");
    expect(world.npcs["start-orphan-friend"]?.name).toBe("Томас Ренн");
    expect(world.npcs["start-minor-steward"]).toBeUndefined();
    for (const npc of Object.values(world.npcs)) {
      for (const entry of npc.schedule) expect(world.locations[entry.locationId]).toBeDefined();
    }
  });

  it("keeps the orphan start with lay caretakers and peers, not a fabricated high priest", () => {
    const summary = describeStartEntourage("temple-orphan");
    expect(summary.companions.map(person => person.role).join(" ")).toContain("смотрительница");
    expect(summary.companions.map(person => person.role).join(" ")).toContain("воспитанник");
    expect(summary.companions.some(person => /епископ|архиепископ|верховный жрец/i.test(person.role))).toBe(false);
  });
});

