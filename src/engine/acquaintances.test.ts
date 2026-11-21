import { describe, expect, it } from "vitest";
import { knownPeople } from "./acquaintances";
import { startVeloriaCampaign } from "../worlds/veloria/campaign";
import { newLifeAttributes } from "../worlds/veloria/character";
import { BIRTH_ORIGINS } from "../worlds/veloria/birthOrigins";

describe("экран «Люди»", () => {
  it("показывает семью с нравом и внешностью, но не то, что они помнят и думают о герое", () => {
    const o = BIRTH_ORIGINS.find(x => x.id === "estran-smith")!;
    const r = startVeloriaCampaign({ kind: "veloria-character", draft: { name: "Лиан", age: 7, sex: "male", birthOriginId: o.id, originId: o.legacyOriginId, statusId: o.statusId, professionId: "none", familyState: "together", startScenarioId: "ordinary", biography: "", familySeed: "people", attributes: newLifeAttributes({ "Сила": 3, "Выносливость": 3, "Ловкость": 3, "Интеллект": 3, "Харизма": 3 }) }, difficultyId: "balanced" });
    if (!r.ok) throw new Error(r.errors.join(" "));
    const people = knownPeople(r.world, r.state);
    expect(people.length).toBeGreaterThan(1);
    const family = people.filter(p => p.family && p.alive);
    expect(family.length).toBeGreaterThan(0);
    for (const p of family) { expect(p.nature).toBeTruthy(); expect(p.nature).not.toMatch(/^(мать|отец):/); }
    const text = JSON.stringify(people);
    for (const p of people) expect(Object.keys(p).sort()).toEqual(expect.arrayContaining(["id", "name", "alive", "family"]));
    expect(text).not.toMatch(/"(trust|sympathy|fear|respect|memory|attitude)"/);
  });
});
