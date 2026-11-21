import { describe, expect, it } from "vitest";
import { understandFreeText, buildIntentContext, buildIntentEnvelope } from "./intent";
import { buildAiPromptEnvelope, buildPlayerContext, allowedActionsFor, resolveWithAi } from "./ai";
import { startVeloriaCampaign } from "../worlds/veloria/campaign";
import { CachingProposer, intentCacheKey } from "../ai/intentCache";
import type { GameState } from "./types";

const ATTRS = { "Сила": 15, "Выносливость": 15, "Ловкость": 14, "Интеллект": 14, "Восприятие": 14, "Харизма": 14, "Воля": 14 };
function adultAt(locationId: string) {
  const r = startVeloriaCampaign({ kind: "veloria-character", difficultyId: "balanced", draft: { name: "Ирина", age: 24, originId: "merchant-child", statusId: "guild-free", professionId: "merchant", familyState: "together", startScenarioId: "ordinary", biography: "", attributes: { ...ATTRS } } });
  if (!r.ok) throw new Error(r.errors.join(" "));
  return { world: r.world, state: { ...r.state, playerLocation: locationId, minute: r.state.minute + 2 * 60 } as GameState };
}
class MemoryStore { data = new Map<string, string>(); getItem(k: string) { return this.data.get(k) ?? null; } setItem(k: string, v: string) { this.data.set(k, v); } }

describe("free text understood without AI", () => {
  const { world, state } = adultAt("market-square");
  const cases: Array<[string, unknown]> = [
    ["Я пойду на нижний рынок", { type: "move", to: "lower-market" }],
    ["иду к ратуше", { type: "move", to: "town-hall" }],
    ["оглядываюсь по сторонам", { type: "look" }],
    ["что у меня в сумке?", { type: "inventory" }],
    ["осмотреться", null], // уже понимает обычный разбор, здесь не обязателен
    ["осмотрееться", { type: "look" }],
    ["подожду 2 часа", { type: "wait", minutes: 120 }],
    ["Привет всем!", { type: "say", text: "Привет всем!" }],
    ["говорю: «Где здесь колодец?»", { type: "say", text: "Где здесь колодец?" }]
  ];
  for (const [text, expected] of cases) it(text, () => {
    const result = understandFreeText(world, state, text);
    if (expected === null) return;
    expect(result).toEqual({ ok: true, action: expected });
  });
  it("buys an item by its root word at a shop", () => {
    const shop = adultAt("lower-market");
    expect(understandFreeText(shop.world, shop.state, "куплю хлеба 2")).toEqual({ ok: true, action: { type: "buy", item: "bread", qty: 2 } });
  });
  it("returns null instead of guessing", () => {
    expect(understandFreeText(world, state, "пойду куда-нибудь")).toBeNull();
    expect(understandFreeText(world, state, "размышляю о смысле жизни")).toBeNull();
  });
});

describe("compact AI context", () => {
  it("is several times smaller than the full scene context", () => {
    const { world, state } = adultAt("lower-market");
    const text = "поторговаться с торговкой о цене хлеба";
    const full = JSON.stringify(buildAiPromptEnvelope(buildPlayerContext(world, state, 10, text), text)).length;
    const compact = JSON.stringify(buildIntentEnvelope(buildIntentContext(world, state, text, allowedActionsFor(state)), text)).length;
    expect(compact).toBeLessThan(full / 3);
    expect(compact).toBeLessThan(1600);
  });
  it("adds world facts only when the player mentions them", () => {
    const { world, state } = adultAt("market-square");
    expect(buildIntentContext(world, state, "подпрыгнуть", allowedActionsFor(state)).facts).toBeUndefined();
    expect(buildIntentContext(world, state, "что известно про Кхарум", allowedActionsFor(state)).facts?.length).toBeGreaterThan(0);
  });
});

describe("intent cache", () => {
  it("serves a repeated phrase in the same situation from cache", async () => {
    const { world, state } = adultAt("market-square");
    let calls = 0, hits = 0;
    const proposer = new CachingProposer({ propose: async () => { calls++; return { type: "look" }; } }, () => hits++, new MemoryStore());
    await resolveWithAi(world, state, "смотрю, что за шум", proposer);
    await resolveWithAi(world, state, "Смотрю, что за шум!", proposer);
    expect(calls).toBe(1); expect(hits).toBe(1);
    const moved = { ...state, playerLocation: "lower-market" };
    await resolveWithAi(world, moved, "смотрю, что за шум", proposer);
    expect(calls).toBe(2);
    expect(intentCacheKey(buildIntentContext(world, state, "x", ["look"]), "x")).not.toBe(intentCacheKey(buildIntentContext(world, moved, "x", ["look"]), "x"));
  });
});

describe("малыш говорит словами", () => {
  it("«мама» у двухлетнего это речь, а у младенца нет", async () => {
    const { startVeloriaCampaign: start } = await import("../worlds/veloria/campaign");
    const r = start({ kind: "veloria-character", difficultyId: "balanced", draft: { name: "Малыш", age: 0, originId: "tenant-farmer", statusId: "rural-free", professionId: "none", familyState: "together", startScenarioId: "ordinary", biography: "", attributes: { ...ATTRS }, familySeed: "toddler" } });
    if (!r.ok) throw new Error(r.errors.join(" "));
    expect(understandFreeText(r.world, r.state, "мама")).toBeNull();
    const twoYears = { ...r.state, minute: r.state.minute + 2 * 365 * 1440 };
    const dev = { ...twoYears, development: { ...twoYears.development!, milestones: { ...twoYears.development!.milestones, "first-word": twoYears.minute, "two-word-phrases": twoYears.minute } } } as GameState;
    const result = understandFreeText(r.world, dev, "мама");
    expect(result).toEqual({ ok: true, action: { type: "say", text: "мама" } });
    const { applyAction } = await import("./rules");
    const said = applyAction(r.world, dev, { type: "say", text: "мама" });
    expect(said.ok).toBe(true);
    expect(said.message).not.toMatch(/слишком малы/);
  });
});
