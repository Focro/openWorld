import { describe, expect, it } from "vitest";
import { applyAction } from "./rules";
import { parseAction } from "./parse";
import { createInitialState, defaultWorld as world, npcLocation, npcsAt } from "./world";
import { dayOf, formatClock, hourOf } from "./time";
import { buildNpcContext, buildPlayerContext, coerceProposal, resolveWithAi } from "./ai";
import { commitState, createSave, currentState, forkBranch, parseSave, serializeSave } from "./save";
import type { Action, GameState } from "./types";

const start = () => createInitialState(world);
const run = (s: GameState, a: Action) => applyAction(world, s, a);
/** Идёт на рынок (10 мин) — в 08:10 Марта уже за прилавком. */
const atMarket = () => run(start(), { type: "move", to: "market" }).state;

describe("time", () => {
  it("formats clock and day rollover", () => {
    expect(formatClock(8 * 60)).toBe("08:00");
    expect(dayOf(23 * 60)).toBe(1);
    expect(dayOf(24 * 60)).toBe(2);
    expect(hourOf(25 * 60)).toBe(1);
  });
  it("wait crosses midnight", () => {
    let s = start();
    s = run(s, { type: "wait", minutes: 720 }).state; // 20:00
    s = run(s, { type: "wait", minutes: 300 }).state; // 01:00 следующего дня
    expect(dayOf(s.minute)).toBe(2);
    expect(hourOf(s.minute)).toBe(1);
  });
});

describe("applyAction: rejected actions do not change the world", () => {
  const rejected: [string, Action][] = [
    ["wait 0", { type: "wait", minutes: 0 }],
    ["wait negative", { type: "wait", minutes: -5 }],
    ["wait too long", { type: "wait", minutes: 721 }],
    ["wait fractional", { type: "wait", minutes: 1.5 }],
    ["wait NaN", { type: "wait", minutes: NaN }],
    ["move to unknown place", { type: "move", to: "moon" }],
    ["move without a direct path", { type: "move", to: "gate" }],   // с рынка прямого пути к воротам нет
    ["buy qty 0", { type: "buy", item: "bread", qty: 0 }],
    ["buy qty 100", { type: "buy", item: "bread", qty: 100 }],
    ["buy unknown item", { type: "buy", item: "gold", qty: 1 }],
    ["buy item the shop does not sell", { type: "buy", item: "clothes", qty: 1 }]
  ];
  for (const [name, action] of rejected) {
    it(`rejects: ${name}`, () => {
      const s = atMarket();
      const r = run(s, action);
      expect(r.ok).toBe(false);
      expect(r.state).toBe(s);
      expect(r.events).toHaveLength(0);
    });
  }
  it("cannot buy where nothing is sold", () => {
    const s = start();
    const r = run(s, { type: "buy", item: "bread", qty: 1 });
    expect(r.ok).toBe(false);
    expect(r.state).toBe(s);
  });
  it("unknown text gives no action", () => {
    expect(parseAction(world, "телепортироваться на луну").ok).toBe(false);
  });
});

describe("movement, schedules and witnesses", () => {
  it("moving costs time and changes location", () => {
    const r = run(start(), { type: "move", to: "tavern" });
    expect(r.ok).toBe(true);
    expect(r.state.playerLocation).toBe("tavern");
    expect(r.state.minute).toBe(8 * 60 + 5);
  });
  it("npc positions follow schedule", () => {
    expect(npcLocation(world, "marta", 8 * 60)).toBe("market");
    expect(npcLocation(world, "marta", 20 * 60)).toBe("tavern");
    expect(npcLocation(world, "vilem", 23 * 60)).toBe("tavern");   // вне расписания — дома
    expect(npcLocation(world, "nobody", 0)).toBeNull();
    expect(npcsAt(world, 8 * 60, "square")).toEqual(["ion"]);
  });
  it("only present npcs remember the event; memories are separate", () => {
    const r = run(start(), { type: "move", to: "market" });
    const s = r.state;
    expect(s.npcMemory.marta).toHaveLength(1);
    expect(s.npcMemory.vilem).toHaveLength(0);
    expect(s.npcMemory.ion).toHaveLength(0);
    expect(s.chronicle).toHaveLength(1);
    expect(s.chronicle[0]!.witnesses).toEqual(["marta"]);
    expect(s.playerMemory.at(-1)!.text).toContain("Вы");
    expect(s.npcMemory.marta![0]!.text).not.toContain("Вы");
  });
});

describe("economy", () => {
  it("buys goods and spends money", () => {
    const r = run(atMarket(), { type: "buy", item: "bread", qty: 2 });
    expect(r.ok).toBe(true);
    expect(r.state.money).toBe(20 - 6);
    expect(r.state.inventory.bread).toBe(2);
  });
  it("refuses when not enough money, no partial change", () => {
    const s = atMarket();
    const r = run(s, { type: "buy", item: "rope", qty: 2 }); // 24 > 20
    expect(r.ok).toBe(false);
    expect(r.state).toBe(s);
  });
  it("refuses when the shopkeeper is away", () => {
    let s = atMarket();
    s = run(s, { type: "wait", minutes: 720 }).state; // 20:10, Марта в таверне
    const r = run(s, { type: "buy", item: "bread", qty: 1 });
    expect(r.ok).toBe(false);
    expect(r.state).toBe(s);
  });
  it("does not mutate the previous state", () => {
    const s = atMarket();
    const frozenMoney = s.money;
    run(s, { type: "buy", item: "bread", qty: 1 });
    expect(s.money).toBe(frozenMoney);
    expect(s.inventory.bread).toBeUndefined();
  });
});

describe("parseAction", () => {
  const act = (t: string) => { const r = parseAction(world, t); return r.ok ? r.action : r.reason; };
  it("parses basic commands", () => {
    expect(act("Осмотреться")).toEqual({ type: "look" });
    expect(act("инвентарь")).toEqual({ type: "inventory" });
    expect(act("подождать")).toEqual({ type: "wait", minutes: 60 });
    expect(act("подождать 30 мин")).toEqual({ type: "wait", minutes: 30 });
    expect(act("подождать 2 часа")).toEqual({ type: "wait", minutes: 120 });
    expect(act("идти в рынок")).toEqual({ type: "move", to: "market" });
    expect(act("пойти таверна")).toEqual({ type: "move", to: "tavern" });
    expect(act("купить хлеб 3")).toEqual({ type: "buy", item: "bread", qty: 3 });
    expect(act("купить хлеб")).toEqual({ type: "buy", item: "bread", qty: 1 });
  });
  it("rejects unknown or empty input", () => {
    expect(parseAction(world, "").ok).toBe(false);
    expect(parseAction(world, "   ").ok).toBe(false);
    expect(parseAction(world, "идти на марс").ok).toBe(false);
    expect(parseAction(world, "купить луну").ok).toBe(false);
    expect(parseAction(world, "подождать долго").ok).toBe(false);
  });
});

describe("AI boundary", () => {
  it("coerces only well-formed proposals and strips extra fields", () => {
    expect(coerceProposal({ type: "move", to: "market", reward: 1000 })).toEqual({ type: "move", to: "market" });
    expect(coerceProposal({ type: "give_gold", amount: 999 })).toBeNull();
    expect(coerceProposal({ type: "wait", minutes: "60" })).toBeNull();
    expect(coerceProposal(null)).toBeNull();
    expect(coerceProposal("move")).toBeNull();
  });
  it("garbage or throwing proposer never changes state", async () => {
    const s = start();
    const garbage = await resolveWithAi(world, s, "x", { propose: async () => ({ type: "set_money", value: 1e9 }) });
    expect(garbage.ok).toBe(false);
    expect(garbage.state).toBe(s);
    const boom = await resolveWithAi(world, s, "x", { propose: async () => { throw new Error("net"); } });
    expect(boom.ok).toBe(false);
    expect(boom.state).toBe(s);
  });
  it("a valid proposal goes through the same rules", async () => {
    const s = start();
    const bad = await resolveWithAi(world, s, "x", { propose: async () => ({ type: "move", to: "moon" }) });
    expect(bad.ok).toBe(false);
    const good = await resolveWithAi(world, s, "x", { propose: async () => ({ type: "move", to: "tavern" }) });
    expect(good.ok).toBe(true);
    expect(good.state.playerLocation).toBe("tavern");
  });
  it("npc context contains only that npc's own memory", () => {
    const s = run(start(), { type: "move", to: "market" }).state;
    const marta = buildNpcContext(world, s, "marta")!;
    const ion = buildNpcContext(world, s, "ion")!;
    expect(marta.memory).toHaveLength(1);
    expect(ion.memory).toHaveLength(0);
    expect(buildNpcContext(world, s, "ghost")).toBeNull();
    expect(JSON.stringify(buildPlayerContext(world, s))).not.toContain("witnesses");
  });
});

describe("saves and branches", () => {
  it("forks a branch without touching the parent", () => {
    let save = createSave(start());
    save = commitState(save, run(currentState(save), { type: "move", to: "market" }).state);
    const forked = forkBranch(save, "alt", 0)!;
    expect(forked.activeBranch).toBe("alt");
    expect(currentState(forked).playerLocation).toBe("square");
    expect(forked.branches.main!.states).toHaveLength(2);
    expect(forked.branches.alt!.parentId).toBe("main");
  });
  it("rejects duplicate ids and bad indices", () => {
    const save = createSave(start());
    expect(forkBranch(save, "main")).toBeNull();
    expect(forkBranch(save, "x", 5)).toBeNull();
    expect(forkBranch(save, "x", -1)).toBeNull();
    expect(forkBranch(save, "")).toBeNull();
  });
  it("round-trips and rejects broken or unknown-version saves", () => {
    const save = createSave(start());
    expect(parseSave(serializeSave(save))).toEqual(save);
    expect(parseSave("not json")).toBeNull();
    expect(parseSave(JSON.stringify({ ...save, schemaVersion: 2 }))).toBeNull();
    expect(parseSave(JSON.stringify({ ...save, activeBranch: "nope" }))).toBeNull();
    expect(parseSave(JSON.stringify({ ...save, branches: { main: { id: "main", states: [] } } }))).toBeNull();
  });
});
