import { describe, expect, it } from "vitest";
import { applyAction } from "./rules";
import { createInitialState, defaultWorld as world } from "./world";
import { MAX_STEP, REL_MAX, REL_MIN, applyRelationDelta, describeAttitude, neutralRelation } from "./relations";
import { GOSSIP_FACTOR, RUMOR_DROP_BELOW, RUMOR_TTL_MINUTES, pruneRumors, spreadGossip } from "./gossip";
import { searchChronicle, whoKnows } from "./memory";
import { buildNpcContext, coerceProposal } from "./ai";
import type { Action, GameState } from "./types";

const start = () => createInitialState(world);
const run = (s: GameState, a: Action) => applyAction(world, s, a);
const atMarket = () => run(start(), { type: "move", to: "market" }).state;
/** Покупка хлеба у Марты, затем ожидание до вечера, когда Марта и Ион оказываются в таверне. */
const boughtThenEvening = () => {
  let s = run(atMarket(), { type: "buy", item: "bread", qty: 1 }).state;
  s = run(s, { type: "wait", minutes: 720 }).state; // 20:10
  return s;
};
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

describe("relations", () => {
  it("changes gradually: one event moves a parameter by at most MAX_STEP", () => {
    const r = applyRelationDelta(neutralRelation(), { trust: 1000, fear: -1000 });
    expect(r.trust).toBe(MAX_STEP);
    expect(r.fear).toBe(-MAX_STEP);
  });
  it("stays within [-100, 100] and ignores non-numbers", () => {
    let r = { trust: 99, sympathy: -99, fear: 0, respect: 0 };
    r = applyRelationDelta(r, { trust: 5, sympathy: -5 });
    r = applyRelationDelta(r, { trust: 5, sympathy: -5 });
    expect(r.trust).toBe(REL_MAX);
    expect(r.sympathy).toBe(REL_MIN);
    const same = applyRelationDelta(neutralRelation(), { trust: NaN, respect: Infinity, fear: "5" as unknown as number });
    expect(same).toEqual(neutralRelation());
  });
  it("parameters are independent", () => {
    const r = applyRelationDelta(neutralRelation(), { trust: 5 });
    expect(r.sympathy).toBe(0);
    expect(r.fear).toBe(0);
    expect(r.respect).toBe(0);
  });
  it("describes attitude in words", () => {
    expect(describeAttitude(neutralRelation())).toBe("нейтрален");
    expect(describeAttitude({ trust: 40, sympathy: 0, fear: 50, respect: -40 })).toContain("боится");
    expect(describeAttitude({ trust: -40, sympathy: 0, fear: 0, respect: 0 })).toContain("не доверяет");
  });
  it("trading changes only the shopkeeper's attitude, and only on success", () => {
    const s = atMarket();
    const ok = run(s, { type: "buy", item: "bread", qty: 1 }).state;
    expect(ok.relations.marta).toEqual({ trust: 2, sympathy: 1, fear: 0, respect: 0 });
    expect(ok.relations.vilem).toEqual(neutralRelation());
    const failed = run(s, { type: "buy", item: "rope", qty: 5 });
    expect(failed.ok).toBe(false);
    expect(failed.state.relations.marta).toEqual(neutralRelation());
  });
  it("repeated trade grows slowly", () => {
    let s = atMarket();
    for (let i = 0; i < 6; i++) s = run(s, { type: "buy", item: "bread", qty: 1 }).state;
    expect(s.relations.marta!.trust).toBe(12);
  });
  it("the AI cannot set relations or inject events", () => {
    expect(coerceProposal({ type: "set_relation", npc: "marta", trust: 100 })).toBeNull();
    expect(coerceProposal({ type: "add_event", text: "Король умер" })).toBeNull();
  });
});

describe("event sources and chronicle search", () => {
  it("events carry id, timestamp and source", () => {
    const s = atMarket();
    const e = s.chronicle[0]!;
    expect(e.id).toBe("e1");
    expect(e.source).toEqual({ kind: "player" });
    expect(e.minute).toBe(8 * 60 + 10);
  });
  it("filters by text, time, place and witness", () => {
    let s = run(atMarket(), { type: "buy", item: "bread", qty: 1 }).state;
    s = run(s, { type: "move", to: "square" }).state;
    expect(searchChronicle(s, {})).toHaveLength(3);
    expect(searchChronicle(s, { text: "КУПИЛ" })).toHaveLength(1);
    expect(searchChronicle(s, { locationId: "market" })).toHaveLength(2);
    expect(searchChronicle(s, { witness: "marta" })).toHaveLength(2);
    expect(searchChronicle(s, { witness: "vilem" })).toHaveLength(0);
    expect(searchChronicle(s, { fromMinute: 8 * 60 + 15 })).toHaveLength(1);
    expect(searchChronicle(s, { toMinute: 8 * 60 + 10 })).toHaveLength(2);
    expect(searchChronicle(s, { sourceId: "nobody" })).toHaveLength(0);
  });
});

describe("limited knowledge and gossip", () => {
  it("only the witness knows right after the event", () => {
    const s = run(atMarket(), { type: "buy", item: "bread", qty: 1 }).state;
    const knowers = whoKnows(s, "e2");
    expect(knowers).toHaveLength(1);
    expect(knowers[0]!.npcId).toBe("marta");
    expect(knowers[0]!.kind).toBe("witnessed");
    expect(knowers[0]!.confidence).toBe(1);
  });
  it("co-located npcs pass the story on with lower confidence; absent ones stay unaware", () => {
    const s = boughtThenEvening();
    const byNpc = Object.fromEntries(whoKnows(s, "e2").map((k) => [k.npcId, k]));
    expect(byNpc.marta!.kind).toBe("witnessed");
    expect(byNpc.ion!.kind).toBe("heard");
    expect(byNpc.ion!.from).toBe("marta");
    expect(close(byNpc.ion!.confidence, GOSSIP_FACTOR)).toBe(true);
    expect(byNpc.vilem).toBeUndefined();            // стражник на посту и ничего не слышал
  });
  it("chronicle (truth) is unchanged by gossip", () => {
    const before = run(atMarket(), { type: "buy", item: "bread", qty: 1 }).state.chronicle[1]!.text;
    const after = boughtThenEvening().chronicle.find((e) => e.id === "e2")!.text;
    expect(after).toBe(before);
  });
  it("a listener takes the most confident version", () => {
    let s = boughtThenEvening();                    // 20:10: Марта (1.0) и Ион (0.7) в таверне
    s = run(s, { type: "wait", minutes: 150 }).state; // 22:40: Вилем дома в таверне
    const v = whoKnows(s, "e2").find((k) => k.npcId === "vilem")!;
    expect(v.from).toBe("marta");
    expect(close(v.confidence, GOSSIP_FACTOR)).toBe(true);
  });
  it("gossip does not run twice on the same state (no duplicate entries)", () => {
    const s = boughtThenEvening();
    const again = spreadGossip(world, s);
    expect(again.npcMemory.ion).toHaveLength(s.npcMemory.ion!.length);
  });
  it("old and unsure rumours are forgotten, firsthand memory is not", () => {
    const base = start();
    const mem = (kind: "heard" | "witnessed", minute: number, confidence: number) =>
      ({ minute, text: "t", kind, confidence, eventId: "e9" } as const);
    const s: GameState = {
      ...base,
      minute: RUMOR_TTL_MINUTES + 100,
      npcMemory: {
        ...base.npcMemory,
        ion: [mem("heard", 0, 0.7), mem("heard", RUMOR_TTL_MINUTES + 50, 0.7), mem("heard", RUMOR_TTL_MINUTES + 50, RUMOR_DROP_BELOW - 0.01)],
        marta: [mem("witnessed", 0, 1)]
      }
    };
    const pruned = pruneRumors(s);
    expect(pruned.npcMemory.ion).toHaveLength(1);
    expect(pruned.npcMemory.marta).toHaveLength(1);
  });
});

describe("npc context for the AI", () => {
  it("includes own goals, attitude and labelled hearsay — not other npcs' data", () => {
    const s = boughtThenEvening();
    const ion = buildNpcContext(world, s, "ion")!;
    expect(ion.goals).toContain("Узнавать все новости города");
    expect(ion.memory.some((m) => m.includes("слух от Марта") && m.includes("70%"))).toBe(true);
    const marta = buildNpcContext(world, s, "marta")!;
    expect(marta.attitudeToPlayer).toBe("нейтрален");   // 2/1 — пока меньше порога
    expect(JSON.stringify(ion)).not.toContain("пекарню");  // цели Марты Иону недоступны
  });
});

describe("look shows what npcs are doing", () => {
  it("lists npc activity from the schedule", () => {
    const r = run(atMarket(), { type: "look" });
    expect(r.message).toContain("Марта (торгует хлебом)");
  });
});

describe("reproducibility", () => {
  it("the same actions always give the same state", () => {
    const play = () => boughtThenEvening();
    expect(play()).toEqual(play());
  });
});
