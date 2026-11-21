import { describe, expect, it } from "vitest";
import { validateWorld } from "../../engine/validate";
import { npcLocation } from "../../engine/world";
import { BIRTH_GROUPS, BIRTH_ORIGINS, BIRTH_STATES, SECOND_PRINCE_ORIGIN_ID } from "./birthOrigins";
import { startVeloriaCampaign } from "./campaign";
import { previewBirthFamily } from "./familyGeneration";
import { MAP_NODES } from "./atlas";
import { newLifeAttributes, type VeloriaCharacterDraft } from "./character";
import { npcAgeYears } from "../../engine/speech";

const attributes = newLifeAttributes({ "Сила": 3, "Выносливость": 3, "Ловкость": 3, "Интеллект": 3, "Харизма": 3 });
const draftFor = (originId: string, age: number, seed = "seed-1", sex: "male" | "female" = "male"): VeloriaCharacterDraft => {
  const origin = BIRTH_ORIGINS.find(o => o.id === originId)!;
  return { name: "Лиан", age, sex, birthOriginId: originId, originId: origin.legacyOriginId, statusId: origin.statusId, professionId: "none", familyState: "together",
    startScenarioId: "ordinary", biography: "", attributes, familySeed: seed };
};

describe("Новая жизнь в Велории: кем родиться", () => {
  it("covers every state with its own people and short cards", () => {
    for (const state of BIRTH_STATES) {
      const own = BIRTH_ORIGINS.filter(o => o.stateId === state.id);
      expect(own.length).toBeGreaterThanOrEqual(8);
      for (const origin of own) expect(MAP_NODES.find(n => n.id === origin.settlementId)?.countryId).toBe(state.id);
    }
    expect(new Set(BIRTH_ORIGINS.map(o => o.id)).size).toBe(BIRTH_ORIGINS.length);
    for (const origin of BIRTH_ORIGINS) {
      expect(origin.blurb.length).toBeLessThanOrEqual(70);
      expect(BIRTH_GROUPS).toContain(origin.group);
      expect(`${origin.label} ${origin.blurb} ${origin.home.description}`).not.toMatch(/—/);
    }
    expect(BIRTH_ORIGINS.filter(o => o.fixed).map(o => o.id)).toEqual([SECOND_PRINCE_ORIGIN_ID]);
    expect(BIRTH_ORIGINS.find(o => o.id === SECOND_PRINCE_ORIGIN_ID)?.stateId).toBe("estran");
  });

  it("starts every ordinary origin at 0, 5 and 12 years in a valid world", () => {
    for (const origin of BIRTH_ORIGINS.filter(o => !o.fixed)) {
      for (const age of [0, 5, 12]) {
        const result = startVeloriaCampaign({ kind: "veloria-character", draft: draftFor(origin.id, age, `s-${origin.id}-${age}`), difficultyId: "balanced" });
        if (!result.ok) throw new Error(`${origin.id} ${age}: ${result.errors.join("; ")}`);
        const { world, state } = result;
        expect(state.settlementId).toBe(origin.settlementId);
        expect(world.locations[state.playerLocation]).toBeDefined();
        const issues = validateWorld(world);
        expect(issues, `${origin.id} ${age}`).toEqual([]);
        // Кто-то из взрослых бывает рядом с ребёнком дома в течение суток.
        const adultsHome = Object.values(world.npcs).filter(n => n.id.startsWith("birth-family-") && (n.age ?? 0) >= 16 && n.lifeStatus === "alive")
          .filter(n => [2, 8, 20].some(h => npcLocation(world, n.id, state.minute - (state.minute % 1440) + h * 60) === state.playerLocation));
        expect(adultsHome.length, `${origin.id} ${age}`).toBeGreaterThan(0);
        if (age === 12) expect(state.development && Object.keys(state.development.attachments).length).toBeGreaterThan(0);
      }
    }
  });

  it("shows only the present in the family preview and is stable per seed", () => {
    const a = previewBirthFamily(draftFor("estran-stablehand", 0, "same"));
    const b = previewBirthFamily(draftFor("estran-stablehand", 0, "same"));
    const c = previewBirthFamily(draftFor("estran-stablehand", 0, "other"));
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(c));
    for (const m of a!.members) if (m.alive) { expect(m.temperament).not.toBe(""); expect(m.appearance).not.toBe(""); }
    expect(JSON.stringify(a)).not.toMatch(/станет|умрёт|будет|—/);
  });

  it("gives Sahrad and Kharum families their own naming", () => {
    const sahrad = previewBirthFamily(draftFor("sahrad-bazaar", 6, "names"))!;
    expect(sahrad.members.find(m => m.role === "отец")?.name).toMatch(/ ибн /);
    const kharum = previewBirthFamily(draftFor("kharum-potters", 6, "names"))!;
    const father = kharum.members.find(m => m.role === "отец")!;
    expect(kharum.members.find(m => m.role === "мать")).toBeDefined();
    expect(father.name.split(" ").length).toBe(2);
  });

  it("keeps the newborn without a mother fed and the older child without a wet nurse", () => {
    let foundNurse = false;
    for (let i = 0; i < 60 && !foundNurse; i++) {
      const p = previewBirthFamily(draftFor("estran-tenant", 0, `nurse-${i}`))!;
      if (p.members.some(m => m.role.startsWith("мать, умерла"))) { expect(p.members.some(m => m.role === "кормилица")).toBe(true); foundNurse = true; }
    }
    for (let i = 0; i < 30; i++) expect(previewBirthFamily(draftFor("estran-tenant", 7, `nurse-${i}`))!.members.some(m => m.role === "кормилица")).toBe(false);
  });

  it("gives every relative their own birthday and friends to an older child", () => {
    const result = startVeloriaCampaign({ kind: "veloria-character", draft: draftFor("estran-smith", 7, "bday"), difficultyId: "balanced" });
    if (!result.ok) throw new Error(result.errors.join(" "));
    const family = Object.values(result.world.npcs).filter(n => n.id.startsWith("birth-family-"));
    expect(family.every(n => n.bornAtMinute !== undefined)).toBe(true);
    const days = new Set(family.map(n => Math.floor(((-(n.bornAtMinute!)) % (365 * 1440)) / 1440)));
    expect(days.size).toBeGreaterThan(1);
    const someone = family.find(n => n.lifeStatus === "alive" && (n.age ?? 0) >= 5)!;
    const ageNow = npcAgeYears(someone, result.state)!;
    const later = { ...result.state, minute: result.state.minute + 365 * 1440 };
    expect(npcAgeYears(someone, later)).toBe(ageNow + 1);
    let friends = 0;
    for (let i = 0; i < 10; i++) friends += previewBirthFamily(draftFor("estran-smith", 7, `fr-${i}`))!.friends.length;
    expect(friends).toBeGreaterThan(0);
    expect(previewBirthFamily(draftFor("estran-smith", 1, "fr-0"))!.friends).toEqual([]);
  });

  it("asks for exactly 15 points over five aptitudes", () => {
    const bad = { ...draftFor("estran-smith", 3), attributes: newLifeAttributes({ "Сила": 5, "Выносливость": 5, "Ловкость": 5, "Интеллект": 5, "Харизма": 5 }) };
    expect(startVeloriaCampaign({ kind: "veloria-character", draft: bad, difficultyId: "balanced" }).ok).toBe(false);
  });

  it("rejects ages above 12", () => {
    const result = startVeloriaCampaign({ kind: "veloria-character", draft: draftFor("estran-smith", 13), difficultyId: "balanced" });
    expect(result.ok).toBe(false);
  });
});
