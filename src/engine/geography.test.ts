import { describe, expect, it } from "vitest";
import { travelMinutes } from "./geography";
import { validateWorld } from "./validate";
import { defaultWorld } from "./world";
import { applyAction } from "./rules";
import { createInitialState } from "./world";
import type { WorldData } from "./types";

const clone = (): WorldData => JSON.parse(JSON.stringify(defaultWorld)) as WorldData;

describe("travelMinutes", () => {
  it("walking speed on a street", () => {
    expect(travelMinutes(400, "street", "walk")).toBe(5);
    expect(travelMinutes(800, "street", "walk")).toBe(10);
    expect(travelMinutes(1200, "road", "walk")).toBe(15);
  });
  it("rounds up and never returns less than 1 minute", () => {
    expect(travelMinutes(401, "street", "walk")).toBe(6);
    expect(travelMinutes(1, "street", "walk")).toBe(1);
  });
  it("rough terrain is slower, a horse is faster", () => {
    expect(travelMinutes(800, "forest", "walk")).toBe(20);
    expect(travelMinutes(800, "mountain", "walk")!).toBeGreaterThan(travelMinutes(800, "forest", "walk")!);
    expect(travelMinutes(800, "road", "horse")!).toBeLessThan(travelMinutes(800, "road", "walk")!);
  });
  it("impassable and invalid input give null", () => {
    expect(travelMinutes(500, "forest", "cart")).toBeNull();
    expect(travelMinutes(0, "street", "walk")).toBeNull();
    expect(travelMinutes(-10, "street", "walk")).toBeNull();
    expect(travelMinutes(NaN, "street", "walk")).toBeNull();
    expect(travelMinutes(Infinity, "street", "walk")).toBeNull();
    expect(travelMinutes(100, "lava" as never, "walk")).toBeNull();
  });
});

describe("validateWorld", () => {
  it("the default world is valid", () => {
    expect(validateWorld(defaultWorld)).toEqual([]);
  });
  it("catches a missing start location, bad exits and one-way roads", () => {
    const w = clone();
    w.startLocationId = "nowhere";
    w.locations.square!.exits.push({ to: "moon", distanceM: 100, terrain: "road" });
    w.locations.tavern!.exits = [];                   // с площади в таверну есть, обратно: нет
    expect(validateWorld(w).length).toBeGreaterThanOrEqual(3);
  });
  it("catches different distances in each direction and bad numbers", () => {
    const w = clone();
    w.locations.market!.exits[0]!.distanceM = 900;
    w.locations.gate!.exits[0]!.distanceM = -5;
    const errors = validateWorld(w).join("\n");
    expect(errors).toContain("различаются");
    expect(errors).toContain("расстояние должно быть");
  });
  it("catches broken shops, items and npcs", () => {
    const w = clone();
    w.locations.market!.shop!.keeperId = "ghost";
    w.locations.market!.shop!.prices["gold"] = 5;
    w.locations.market!.shop!.prices["bread"] = 0;
    w.npcs.ion!.homeId = "void";
    w.npcs.vilem!.schedule[0]!.from = 30;
    w.startInventory["sword"] = 1;
    expect(validateWorld(w).length).toBeGreaterThanOrEqual(6);
  });
});

describe("movement uses real distances", () => {
  it("travel time comes from distance and terrain", () => {
    const s = createInitialState(defaultWorld);
    const r = applyAction(defaultWorld, s, { type: "move", to: "gate" });
    expect(r.ok).toBe(true);
    expect(r.state.minute).toBe(s.minute + 15);
  });
  it("swamp makes the same road much slower", () => {
    const w = clone();
    w.locations.square!.exits[2]!.terrain = "swamp";
    w.locations.gate!.exits[0]!.terrain = "swamp";
    const s = createInitialState(w);
    const swamp = applyAction(w, s, { type: "move", to: "gate" });
    expect(swamp.ok).toBe(true);                              // пешком по болоту можно, но долго
    expect(swamp.state.minute).toBe(s.minute + 50);           // 1200 / (80 × 0.3) = 50
  });
});
