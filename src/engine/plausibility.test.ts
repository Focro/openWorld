import { describe, expect, it } from "vitest";
import { detectOutcomeClaim, resolveAttempt } from "./plausibility";
import { applyAction } from "./rules";
import { understandFreeText } from "./intent";
import { startVeloriaCampaign } from "../worlds/veloria/campaign";
import { newLifeAttributes, type VeloriaCharacterDraft } from "../worlds/veloria/character";
import { BIRTH_ORIGINS } from "../worlds/veloria/birthOrigins";

const childStart = () => {
  const o = BIRTH_ORIGINS.find(x => x.id === "estran-stablehand")!;
  const draft: VeloriaCharacterDraft = { name: "Лиан", age: 10, sex: "male", birthOriginId: o.id, originId: o.legacyOriginId, statusId: o.statusId, professionId: "none", familyState: "together", startScenarioId: "ordinary", biography: "", familySeed: "plaus",
    attributes: newLifeAttributes({ "Сила": 3, "Выносливость": 3, "Ловкость": 3, "Интеллект": 1, "Харизма": 5 }) };
  const r = startVeloriaCampaign({ kind: "veloria-character", draft, difficultyId: "balanced" });
  if (!r.ok) throw new Error(r.errors.join(" "));
  return r;
};

describe("правдоподобие: игрок пишет попытку, исход решает движок", () => {
  it("узнаёт заявления об исходе", () => {
    expect(detectOutcomeClaim("Я влюбил её в себя")).toBe("charm");
    expect(detectOutcomeClaim("заставила его влюбиться")).toBe("charm");
    expect(detectOutcomeClaim("пробудил в себе неведомую силу")).toBe("power");
    expect(detectOutcomeClaim("убедил стражника пропустить меня")).toBe("persuade");
    expect(detectOutcomeClaim("иду на рынок")).toBeNull();
    expect(detectOutcomeClaim("Мне страшно, мама")).toBeNull();
  });

  it("сверхсилу получить нельзя", () => {
    const { world, state } = childStart();
    const r = applyAction(world, state, { type: "gesture", text: "пробуждаю в себе древнюю силу и обретаю дар" });
    expect(r.ok).toBe(true);
    expect(r.message).toContain("Сверхспособностей в этом мире нет");
    expect(r.state.chronicle.at(-1)!.text).toContain("[Итог по правилам: Никакой силы");
  });

  it("ребёнок никого не влюбляет, даже с высоким обаянием", () => {
    const { world, state } = childStart();
    const mother = Object.keys(world.npcs).find(id => id.endsWith("-parent-b"))!;
    const out = resolveAttempt(world, state, "я влюбил её в себя", [mother])!;
    expect(out.result).toBe("fail");
    expect(out.rule).toMatch(/влюблённост/);
  });

  it("у взрослого исход зависит от обаяния, и по одной фразе любви не бывает", () => {
    const { world, state } = childStart();
    const target = Object.keys(world.npcs).find(id => id.endsWith("-parent-b"))!;
    world.npcs[target] = { ...world.npcs[target]!, age: 30, bornAtMinute: state.minute - 30 * 365 * 1440 };
    const grown = (charisma: number) => ({ ...state, development: undefined, playerProfile: { ...state.playerProfile!, age: 25, attributes: { ...state.playerProfile!.attributes, "Харизма": charisma } } });
    const wins = (charisma: number) => Array.from({ length: 200 }, (_, i) => resolveAttempt(world, { ...grown(charisma), minute: state.minute + i }, "очаровала его", [target])!).filter(o => o.result === "success").length;
    expect(wins(26)).toBeGreaterThan(wins(6));
    const best = Array.from({ length: 200 }, (_, i) => resolveAttempt(world, { ...grown(26), minute: state.minute + i }, "очаровала его", [target])!);
    for (const o of best) expect((o.relation?.sympathy ?? 0)).toBeLessThanOrEqual(6);
  });

  it("работает без ИИ: свободный текст сам уходит в проверку", () => {
    const { world, state } = childStart();
    const parsed = understandFreeText(world, state, "я пробуждаю в себе древнюю силу");
    expect(parsed).toEqual({ ok: true, action: { type: "gesture", text: "я пробуждаю в себе древнюю силу" } });
    const r = applyAction(world, state, (parsed as { ok: true; action: { type: "gesture"; text: string } }).action);
    expect(r.ok).toBe(true);
    expect(JSON.stringify(r)).toMatch(/Сверхспособностей в этом мире нет/);
  });

  it("«убежал на рынок» ведёт туда, даже если рынок не за дверью", () => {
    const { world, state } = childStart();
    const parsed = understandFreeText(world, state, "убежал на рынок");
    expect(parsed?.ok).toBe(true);
    const action = (parsed as { ok: true; action: { type: "move"; to: string } }).action;
    expect(action.type).toBe("move");
    const r = applyAction(world, state, action);
    expect(r.ok).toBe(true);
    expect(r.state.playerLocation).toBe(action.to);
    expect(r.state.minute).toBeGreaterThan(state.minute);
  });
});
