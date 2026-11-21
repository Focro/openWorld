import { describe, expect, it } from "vitest";
import { getWorldDifficulty, WORLD_DIFFICULTIES } from "./difficulty";

describe("fixed world difficulty", () => {
  it("offers three stable presets", () => {
    expect(Object.keys(WORLD_DIFFICULTIES)).toEqual(["peaceful", "balanced", "harsh"]);
  });
  it("never scales natural aging or difficulty adaptively", () => {
    for (const preset of Object.values(WORLD_DIFFICULTIES)) {
      expect(preset.naturalAging).toBe(1);
      expect(preset.adaptiveScaling).toBe(false);
    }
  });
  it("makes peaceful mode safer without making the character immortal", () => {
    const peaceful = getWorldDifficulty("peaceful");
    expect(peaceful.violenceRisk).toBeLessThan(1);
    expect(peaceful.diseaseRisk).toBeLessThan(1);
    expect(peaceful.naturalAging).toBe(1);
  });
});
