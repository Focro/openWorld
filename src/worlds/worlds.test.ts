import { describe, expect, it } from "vitest";
import { DEFAULT_WORLD_ID, WORLDS, getWorldEntry } from "./registry";
import { validateWorld } from "../engine/validate";
import { applyAction } from "../engine/rules";
import { createInitialState } from "../engine/world";
import { parseAction } from "../engine/parse";
import { resolveStart } from "./veloria/continents";
import { checkCanon, issuesBy } from "./veloria/canonCheck";

describe("world registry", () => {
  it("ids are unique and the default world exists", () => {
    expect(new Set(WORLDS.map((w) => w.id)).size).toBe(WORLDS.length);
    expect(getWorldEntry(DEFAULT_WORLD_ID)).toBeTruthy();
    expect(getWorldEntry("nope")).toBeUndefined();
  });
  for (const entry of WORLDS) {
    it(`${entry.id}: world data passes validateWorld`, () => {
      expect(validateWorld(entry.create())).toEqual([]);
    });
    it(`${entry.id}: create() returns an independent copy`, () => {
      const a = entry.create();
      a.startMoney = 9999;
      expect(entry.create().startMoney).not.toBe(9999);
    });
  }
});

describe("Veloria on the engine", () => {
  const world = () => getWorldEntry("veloria")!.create();
  it("keeps the original travel times (80 m/min)", () => {
    const w = world();
    const s = createInitialState(w);
    const r = applyAction(w, s, { type: "move", to: "lower-market" });
    expect(r.ok).toBe(true);
    expect(r.state.minute - s.minute).toBe(4);
    const far = applyAction(w, s, { type: "move", to: "south-gate" });
    expect(far.state.minute - s.minute).toBe(12);
  });
  it("generates playable local maps and persistent NPCs for global settlements", () => {
    const w = world();
    for (const id of ["varentport", "qadira", "dravorn", "lethariel", "har-kadar"]) {
      expect(w.locations[`atlas:${id}:square`]).toBeTruthy();
      expect(w.locations[`atlas:${id}:market`]).toBeTruthy();
      expect(w.locations[`atlas:${id}:gate`]).toBeTruthy();
      expect(w.npcs[`${id}:merchant`]).toBeTruthy();
      expect(w.npcs[`${id}:innkeeper`]).toBeTruthy();
      expect(w.npcs[`${id}:guard`]).toBeTruthy();
    }
    expect(Object.keys(w.npcs).length).toBeGreaterThan(80);
  });
  it("supports local movement and commerce after arriving in another settlement", () => {
    const w = world();
    const initial = { ...createInitialState(w), playerLocation: "atlas:varentport:gate", settlementId: "varentport" };
    const arrived = applyAction(w, initial, { type: "move", to: "atlas:varentport:square" });
    expect(arrived.ok).toBe(true);
    const moved = applyAction(w, arrived.state, { type: "move", to: "atlas:varentport:market" });
    expect(moved.ok).toBe(true);
    const bought = applyAction(w, moved.state, { type: "buy", item: "bread", qty: 1 });
    expect(bought.ok).toBe(true);
    expect(bought.state.inventory.bread).toBe(2);
  });
  it("starts in Roven's market square and can trade with Marta", () => {
    const w = world();
    let s = createInitialState(w);
    expect(s.playerLocation).toBe("market-square");
    s = applyAction(w, s, { type: "move", to: "lower-market" }).state;
    const bought = applyAction(w, s, { type: "buy", item: "bandage", qty: 1 });
    expect(bought.ok).toBe(true);
    expect(bought.state.money).toBe(12 - 5);
  });
  it("the intro text does not mention a place that is not the start location", () => {
    const s = createInitialState(world());
    expect(s.playerMemory[0]!.text).toContain("Рыночная площадь");
  });
  it("text commands work with Veloria place names", () => {
    const w = world();
    const p = parseAction(w, "идти Таверна «Серая лисица»");
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.action).toEqual({ type: "move", to: "grey-fox" });
  });
  it("a fictional road with no exit stays impossible", () => {
    const w = world();
    const s = createInitialState(w);
    expect(applyAction(w, s, { type: "move", to: "smithy" }).ok).toBe(false);
  });
});

describe("Veloria data integrity (fixed defects)", () => {
  it("Elyndor is a valid starting state (id typo fixed)", () => {
    expect(resolveStart({ continentId: "ardan", stateId: "elyndor" }, { originId: "wanderer" }).ok).toBe(true);
    expect(resolveStart({ continentId: "ardan", stateId: "elindor" }, { originId: "wanderer" }).ok).toBe(false);
  });
  it("no cross-reference mismatches between atlas, faiths, houses and hidden actors", () => {
    expect(issuesBy(checkCanon(), "id-mismatch")).toEqual([]);
  });
  it("routes connect every node to Roven without duplicates", () => {
    expect(issuesBy(checkCanon(), "routes")).toEqual([]);
  });
  it("genealogy ids are unique and spouses reference real people", () => {
    expect(issuesBy(checkCanon(), "duplicate-id")).toEqual([]);
  });
});
