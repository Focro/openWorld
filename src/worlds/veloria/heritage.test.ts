import { describe, expect, it } from "vitest";
import { getChildAppearanceOptions, validateChildAppearance, type ParentHeritage } from "./heritage";

const father: ParentHeritage = { id: "father", name: "Отец", appearance: { skinTone: 2, hairColor: "blond", hairTexture: "straight", eyeColor: "blue", facialFeatures: "narrow" } };
const mother: ParentHeritage = { id: "mother", name: "Мать", appearance: { skinTone: 3, hairColor: "brown", hairTexture: "wavy", eyeColor: "green", facialFeatures: "soft" } };

describe("Veloria inherited appearance", () => {
  it("limits a child's skin tone to a plausible range from both known parents", () => {
    const options = getChildAppearanceOptions(father, mother);
    expect(options.parentsKnown).toBe(true);
    if (options.parentsKnown) {
      expect(options.skinMin).toBe(1);
      expect(options.skinMax).toBe(4);
    }
    const impossible = validateChildAppearance(father, mother, {
      skinTone: 9, hairColor: "black", hairTexture: "coiled", eyeColor: "amber", facialFeatures: "broad"
    });
    expect(impossible.length).toBeGreaterThan(0);
  });
  it("allows mixed traits from both parents", () => {
    const errors = validateChildAppearance(father, mother, {
      skinTone: 3, hairColor: "blond", hairTexture: "wavy", eyeColor: "green", facialFeatures: "mixed"
    });
    expect(errors).toEqual([]);
  });
  it("does not treat an unknown parent as permission for any phenotype", () => {
    expect(getChildAppearanceOptions(father, undefined)).toEqual({
      parentsKnown: false,
      unrestricted: false,
      needsLineageResolution: true,
      knownParents: [{ id: "father", name: "Отец" }],
      unknownParentCount: 1
    });
  });
  it("keeps both parent lines unresolved when neither biological parent is known", () => {
    expect(getChildAppearanceOptions()).toEqual({
      parentsKnown: false,
      unrestricted: false,
      needsLineageResolution: true,
      knownParents: [],
      unknownParentCount: 2
    });
  });
});

describe("family limits", () => {
  it("does not allow an unrelated very dark phenotype from two light-skinned parents", () => {
    const errors = validateChildAppearance(father, mother, {
      skinTone: 9, hairColor: "brown", hairTexture: "wavy", eyeColor: "green", facialFeatures: "mixed"
    });
    expect(errors.some(error => /тон кожи/i.test(error))).toBe(true);
  });
  it("allows a wider range when a parent has documented family variants", () => {
    const parentWithKnownFamily: ParentHeritage = {
      ...mother,
      familyVariants: { skinToneRange: [3, 8], hairColors: ["black"], eyeColors: ["brown"] }
    };
    const options = getChildAppearanceOptions(father, parentWithKnownFamily);
    expect(options.parentsKnown).toBe(true);
    if (options.parentsKnown) expect(options.skinMax).toBe(8);
  });
});


describe("facial feature inheritance", () => {
  it("does not offer an unrelated mixed phenotype when both parents have the same documented features", () => {
    const a: ParentHeritage = { id: "parent-a", name: "Родитель А", appearance: { skinTone: 3, hairColor: "brown", hairTexture: "straight", eyeColor: "brown", facialFeatures: "angular" } };
    const b: ParentHeritage = { id: "parent-b", name: "Родитель Б", appearance: { skinTone: 3, hairColor: "brown", hairTexture: "straight", eyeColor: "brown", facialFeatures: "angular" } };
    const options = getChildAppearanceOptions(a, b);
    expect(options.parentsKnown).toBe(true);
    if (options.parentsKnown) expect(options.facialFeatures).toEqual(["angular"]);
    expect(validateChildAppearance(a, b, { skinTone: 3, hairColor: "brown", hairTexture: "straight", eyeColor: "brown", facialFeatures: "mixed" })).toContain("Черты лица не укладываются в доступные варианты наследования.");
  });
});
