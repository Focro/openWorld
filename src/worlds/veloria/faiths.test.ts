import { describe, expect, it } from "vitest";
import { FAITHS } from "./faiths";

describe("Veloria religious canon", () => {
  it("contains six distinct traditions with full basic records", () => {
    expect(FAITHS).toHaveLength(6);
    for (const faith of FAITHS) {
      expect(faith.foundingEvent.length).toBeGreaterThan(20);
      expect(faith.canonicalTexts.length).toBeGreaterThan(0);
      expect(faith.clergyStructure.length).toBeGreaterThan(0);
      expect(faith.rites.map(x => x.lifeStage)).toEqual(expect.arrayContaining(["рождение","совершеннолетие","брак","смерть","посвящение"]));
      expect(faith.schisms.length).toBeGreaterThan(0);
      expect(faith.holidays.length).toBeGreaterThan(0);
    }
  });

  it("preserves the canonical founding dates", () => {
    const year = (id: string) => FAITHS.find(x => x.id === id)!.foundedYear;
    expect(year("path_of_wells")).toBe(137);
    expect(year("sevenfold")).toBe(186);
    expect(year("stone_oath")).toBe(196);
    expect(year("open_lantern")).toBe(241);
    expect(year("imperial_sun")).toBe(319);
    expect(FAITHS.find(x => x.id === "green_memory")!.foundedBeforeYear).toBe(0);
  });

  it("keeps the Seven Lights distinct from the later Seven Virtues commentary", () => {
    const faith = FAITHS.find(x => x.id === "sevenfold")!;
    expect(faith.principles).toEqual(["милосердие","долг","память","гостеприимство","мера","правда","надежда"]);
    expect(faith.canonicalTexts.find(x => x.id === "seven-virtues-commentary")!.canonStatus).toBe("commentary");
  });
});
