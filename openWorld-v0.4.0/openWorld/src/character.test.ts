import { describe, expect, it } from "vitest";
import { attributes, validateCharacter } from "./character";

const valid = () => ({
  name: "Путник",
  concept: "",
  attributes: { Сила: 16, Выносливость: 15, Ловкость: 15, Интеллект: 14, Восприятие: 14, Харизма: 12, Воля: 14 } as Record<string, number>
});

describe("validateCharacter", () => {
  it("accepts a valid build (7 attributes, sum 100)", () => {
    expect(attributes).toHaveLength(7);
    expect(validateCharacter(valid()).ok).toBe(true);
  });
  it("rejects wrong sum", () => {
    const c = valid(); c.attributes["Сила"] = 17;
    expect(validateCharacter(c).ok).toBe(false);
  });
  it("rejects values outside 1..30 and non-integers", () => {
    const hi = valid(); hi.attributes["Сила"] = 31; hi.attributes["Воля"] = 13;
    expect(validateCharacter(hi).ok).toBe(false);
    const lo = valid(); lo.attributes["Сила"] = 0; lo.attributes["Воля"] = 30;
    expect(validateCharacter(lo).ok).toBe(false);
    const frac = valid(); frac.attributes["Сила"] = 15.5; frac.attributes["Воля"] = 14.5;
    expect(validateCharacter(frac).ok).toBe(false);
  });
  it("rejects missing or extra attributes even if the sum is 100", () => {
    const missing = valid(); delete missing.attributes["Харизма"]; missing.attributes["Сила"] = 28;
    expect(validateCharacter(missing).ok).toBe(false);
    const extra = valid(); extra.attributes["Удача"] = 0; extra.attributes["Сила"] = 16;
    expect(validateCharacter(extra).ok).toBe(false);
  });
  it("rejects empty name and overlong fields", () => {
    expect(validateCharacter({ ...valid(), name: "   " }).ok).toBe(false);
    expect(validateCharacter({ ...valid(), name: "я".repeat(41) }).ok).toBe(false);
    expect(validateCharacter({ ...valid(), concept: "я".repeat(501) }).ok).toBe(false);
  });
});
