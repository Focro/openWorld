import { describe, expect, it } from "vitest";
import { checkCanon } from "./canonCheck";
import { INSTITUTIONS } from "./institutions";
import { NOBLE_HOUSES, validateGenealogies } from "./nobleHouses";
import { SECRET_CULTS } from "./cults";
import { BLACK_MARKETS } from "./blackMarkets";
import { RARE_PEOPLES } from "./peoples";
import { RARE_INDIVIDUALS } from "./rareIndividuals";

describe("Veloria canon integrity", () => {
  it("registers institutions separately from noble houses and cities", () => {
    const institutionIds = new Set(INSTITUTIONS.map(x => x.id));
    expect(institutionIds.has("northwatch-guild")).toBe(true);
    expect(institutionIds.has("qadira-water-council")).toBe(true);
    expect(institutionIds.has("azrakar-bureau")).toBe(true);
    expect(NOBLE_HOUSES.some(h => h.id === "house-azrakar")).toBe(true);
    expect(NOBLE_HOUSES.some(h => h.id === "azrakar")).toBe(false);
  });

  it("stores remote ancestors separately from direct parents", () => {
    const reynar = NOBLE_HOUSES.find(h => h.id === "reynar")!;
    const eliana = reynar.members.find(m => m.id === "rey-elin")!;
    expect(eliana.parentIds).not.toContain("rey-aldric");
    expect(eliana.ancestorIds).toContain("rey-aldric");
    expect(validateGenealogies()).toEqual([]);
  });

  it("does not label undocumented centenarians as confirmed alive", () => {
    for (const house of NOBLE_HOUSES) for (const person of house.members) {
      if (742 - person.birthYear > 100 && person.deathYear === undefined) {
        expect(person.status).not.toBe("alive");
      }
    }
  });

  it("registers distinct cults, local black markets and rare peoples", () => {
    expect(SECRET_CULTS.length).toBeGreaterThanOrEqual(3);
    expect(BLACK_MARKETS.some(x => x.nodeId === "roven" && x.visibility === "rumored")).toBe(true);
    expect(RARE_PEOPLES.some(x => x.id === "elvari")).toBe(true);
    expect(RARE_PEOPLES.some(x => x.id === "vampirism" && x.kind === "condition")).toBe(true);
    expect(RARE_INDIVIDUALS.some(x => x.id === "nera-of-roven" && x.speciesId === "elvari")).toBe(true);
  });

  it("recognizes all structural references", () => {
    const issues = checkCanon();
    expect(issues.filter(x => x.category === "dangling-ref")).toEqual([]);
    expect(issues.filter(x => x.category === "id-collision")).toEqual([]);
    expect(issues.filter(x => x.category === "parent-gap")).toEqual([]);
    expect(issues.filter(x => x.category === "founding-date")).toEqual([]);
    expect(issues).toEqual([]);
  });
});
