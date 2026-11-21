import { describe, expect, it } from "vitest";
import { npcActivity, npcLocation, npcPresence } from "./world";
import { VELORIA_WORLD } from "../worlds/veloria/world";

describe("physical NPC movement on local schedules", () => {
  it("does not teleport Marta from home to the market at shift start", () => {
    expect(npcPresence(VELORIA_WORLD, "marta", 6 * 60)).toEqual({
      kind: "traveling", from: "grey-fox", to: "lower-market", minutesRemaining: 9
    });
    expect(npcLocation(VELORIA_WORLD, "marta", 6 * 60)).toBeNull();
    expect(npcLocation(VELORIA_WORLD, "marta", 6 * 60 + 10)).toBe("lower-market");
  });
  it("makes a scheduled return trip before the NPC is present at home", () => {
    expect(npcPresence(VELORIA_WORLD, "marta", 17 * 60)).toEqual({
      kind: "traveling", from: "lower-market", to: "grey-fox", minutesRemaining: 9
    });
    expect(npcActivity(VELORIA_WORLD, "marta", 17 * 60)).toContain("идёт");
    expect(npcLocation(VELORIA_WORLD, "marta", 17 * 60 + 10)).toBe("grey-fox");
  });
});
