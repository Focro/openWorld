import { describe, expect, it } from "vitest";
import { applyScene, buildSceneContext, buildSceneEnvelope, coerceScene, speechProfile, stripDashes, addressedNpc, removeHeroActions, removeSexualContent, SCENE_INSTRUCTIONS } from "./speech";
import { applyAction } from "./rules";
import { npcsAt } from "./world";
import { startVeloriaCampaign } from "../worlds/veloria/campaign";
import type { GameState, NpcDef, WorldData } from "./types";

const ATTRS = { "Сила": 15, "Выносливость": 15, "Ловкость": 14, "Интеллект": 14, "Восприятие": 14, "Харизма": 14, "Воля": 14 };
function adult(): { world: WorldData; state: GameState } {
  const r = startVeloriaCampaign({ kind: "veloria-character", difficultyId: "balanced", draft: { name: "Ирина", age: 24, originId: "merchant-child", statusId: "guild-free", professionId: "merchant", familyState: "together", startScenarioId: "ordinary", biography: "", attributes: { ...ATTRS } } });
  if (!r.ok) throw new Error(r.errors.join(" "));
  return { world: r.world, state: r.state };
}
/** Находит место и время, где рядом с игроком есть люди. */
function crowded(world: WorldData, state: GameState): GameState {
  for (let hour = 0; hour < 24; hour++) for (const id of Object.keys(world.locations)) {
    const minute = state.minute + hour * 60;
    if (npcsAt(world, minute, id, state.npcDeaths).length >= 1) return { ...state, minute, playerLocation: id };
  }
  throw new Error("нет людей");
}
const npc = (id: string, extra: Partial<NpcDef>): NpcDef => ({ id, name: id, homeId: "x", goals: [], schedule: [], ...extra });

describe("речь NPC: паспорт голоса", () => {
  const { world, state } = adult();
  it("девочка и взрослый мужчина звучат по-разному", () => {
    const w: WorldData = { ...world, npcs: { ...world.npcs, girl: npc("girl", { age: 6, roleTags: ["commoner"] }), smith: npc("smith", { age: 30, roleTags: ["guard"], originStateId: "tharvek" }) } };
    const girl = speechProfile(w, state, "girl"), smith = speechProfile(w, state, "smith");
    expect(girl).toMatch(/ребёнок 6 лет/);
    expect(girl).not.toMatch(/по-служебному|книжная/);
    expect(smith).toMatch(/30 лет/);
    expect(smith).toMatch(/скупо и прямо/);
    expect(girl).not.toEqual(smith);
  });
  it("короткий и без длинного тире", () => {
    for (const id of Object.keys(world.npcs).slice(0, 40)) {
      const profile = speechProfile(world, state, id);
      expect(profile.length).toBeLessThan(260);
      expect(profile).not.toMatch(/[—–]/);
    }
  });
  it("stripDashes убирает тире", () => {
    expect(stripDashes("Да — конечно. — Иди")).toBe("Да, конечно. Иди");
    expect(stripDashes("— Привет")).toBe("Привет");
    expect(stripDashes("северо—запад")).toBe("северо-запад");
  });
});

describe("живая сцена", () => {
  const base = adult();
  const state = crowded(base.world, base.state);
  const world = base.world;
  const present = npcsAt(world, state.minute, state.playerLocation, state.npcDeaths);
  const first = world.npcs[present[0]!]!;
  const firstName = first.name.split(/\s+[—–-]\s+/)[0]!;

  it("компактный контекст: люди рядом, их голоса и отношение, без биографий", () => {
    const context = buildSceneContext(world, state, `Здравствуйте, ${firstName}!`);
    expect(context.npcs.length).toBeGreaterThan(0);
    expect(context.npcs.length).toBeLessThanOrEqual(4);
    expect(context.to).toBe(first.id);
    expect(context.npcs[0]!.id).toBe(first.id);
    expect(context.npcs[0]!.talk.length).toBeGreaterThan(5);
    const envelope = buildSceneEnvelope(context, "Здравствуйте");
    expect(JSON.stringify(envelope.context).length).toBeLessThan(2500);
    expect(envelope.outputContract.speakers).toContain(first.id);
  });

  it("обращение по имени находит адресата", () => {
    expect(addressedNpc(world, present, `${firstName}, ты тут?`)).toBe(first.id);
    expect(addressedNpc(world, present, "кто-нибудь?")).toBeUndefined();
  });

  it("говорят только присутствующие, текст очищен, длинные ответы не режутся", () => {
    const scene = coerceScene({ replies: [
      { npc: first.id, text: "«Ну здравствуй — давно не виделись»" },
      { npc: "stranger", text: "меня тут нет" },
      { npc: first.id, text: "второе" },
      { npc: first.id, text: "третье" }
    ], narration: "Кивает — устало." }, present);
    expect(scene).not.toBeNull();
    expect(scene!.replies).toHaveLength(3);
    const long = "Слово ".repeat(250).trim();
    expect(coerceScene({ replies: [{ npc: first.id, text: long }] }, present)!.replies[0]!.text).toBe(long);
    expect(scene!.replies[0]!.text).toBe("Ну здравствуй, давно не виделись");
    expect(scene!.narration).toBe("Кивает, устало.");
    expect(coerceScene({ replies: [] }, present)).toBeNull();
    expect(coerceScene("мусор", present)).toBeNull();
  });

  it("сказанное попадает в хронику, память свидетелей и игрока", () => {
    const said = applyAction(world, state, { type: "say", text: `Привет, ${firstName}` });
    expect(said.ok).toBe(true);
    const { state: next, lines } = applyScene(world, said.state, { replies: [{ npcId: first.id, text: "И тебе привет." }] });
    expect(lines[0]).toContain("И тебе привет.");
    const last = next.chronicle.at(-1)!;
    expect(last.source).toEqual({ kind: "npc", id: first.id });
    expect(next.npcMemory[first.id]!.at(-1)!.text).toContain("И тебе привет.");
    expect(next.playerMemory.at(-1)!.text).toContain("И тебе привет.");
    expect(next.minute).toBe(said.state.minute);
    // Следующая сцена помнит разговор.
    expect(buildSceneContext(world, next, "а ещё?").recent.join(" ")).toContain("И тебе привет.");
  });
});

describe("мир не пишет за героя", () => {
  it("убирает действия, слова и чувства героя, оставляет мир и других людей", () => {
    const text = "Над рынком висит запах тёплого хлеба. Вы улыбаетесь торговке. Марта поднимает глаза и берёт вас за руку. Ты чувствуешь тепло.\nВаше сердце сжимается. Ирина кивает в ответ. Вас охватывает тревога. Ветер треплет навес.";
    const result = removeHeroActions(text, "Ирина Вейл");
    expect(result.text).toContain("запах тёплого хлеба");
    expect(result.text).toContain("Марта поднимает глаза и берёт вас за руку.");
    expect(result.text).toContain("Ветер треплет навес.");
    expect(result.text).not.toMatch(/улыбаетесь|чувствуешь|сердце|кивает|охватывает/);
    expect(result.removed).toBe(5);
  });
  it("английский текст тоже", () => {
    const result = removeHeroActions("Rain drums on the roof. You nod slowly. The guard frowns at you. You feel cold.", "Irina");
    expect(result.text).toBe("Rain drums on the roof. The guard frowns at you.");
  });
  it("запрет есть в инструкциях, а проверка срабатывает в coerceScene", () => {
    expect(SCENE_INSTRUCTIONS.join(" ")).toMatch(/никогда не пишешь за героя/);
    const scene = coerceScene({ replies: [], narration: "Лавка пахнет кожей. Вы решаете уйти." }, [], "Ирина");
    expect(scene!.narration).toBe("Лавка пахнет кожей.");
  });
  it("осмотр получает описание места, разговор нет", () => {
    const { world, state } = adult();
    expect(buildSceneContext(world, state, "осмотреться", { event: "look" }).place).toBeTruthy();
    expect(buildSceneContext(world, state, "привет", { event: "speech" }).place).toBeUndefined();
  });
});

describe("взрослые темы и несовершеннолетние", () => {
  const { world, state } = adult();
  it("взрослый режим включается только по выбору игрока и только без несовершеннолетних", () => {
    expect(buildSceneContext(world, state, "привет").adult).toBe(false);
    const grown = buildSceneContext(world, state, "привет", { adult: true });
    expect(grown.adult).toBe(grown.minors ? false : true);
    const child: GameState = { ...state, playerProfile: { ...state.playerProfile!, age: 12 }, ...(state.development ? { development: { ...state.development, birthMinute: state.minute - 12 * 365 * 1440 } } : {}) };
    const ctx = buildSceneContext(world, child, "привет", { adult: true });
    expect(ctx.adult).toBe(false);
    expect(ctx.minors).toBe(true);
  });
  it("ребёнок рядом тоже исключает взрослые сцены", () => {
    const busy = crowded(world, state);
    const host = world.npcs[npcsAt(world, busy.minute, busy.playerLocation, busy.npcDeaths)[0]!]!;
    const w: WorldData = { ...world, npcs: { ...world.npcs, kid: npc("kid", { age: 9, homeId: host.homeId, schedule: host.schedule, lifeSchedules: host.lifeSchedules }) } };
    expect(npcsAt(w, busy.minute, busy.playerLocation, busy.npcDeaths)).toContain("kid");
    const ctx = buildSceneContext(w, busy, "привет", { adult: true });
    expect(ctx.minors).toBe(true);
    expect(ctx.adult).toBe(false);
  });
  it("сексуальные описания вырезаются, если они запрещены, и остаются, если разрешены", () => {
    const narration = "В комнате пахнет воском. Их стоны от страсти слышны за стеной. Свеча догорает.";
    expect(coerceScene({ replies: [], narration }, [], "Ирина", false)!.narration).toBe("В комнате пахнет воском. Свеча догорает.");
    expect(coerceScene({ replies: [], narration }, [], "Ирина", true)!.narration).toBe(narration);
    // Слово «член» в обычном смысле не трогаем.
    expect(removeSexualContent("Он член городского совета.").removed).toBe(0);
  });
  it("у людей свои цели и мораль, повествование в выбранном лице", () => {
    const ctx = buildSceneContext(world, state, "привет", { person: "3" });
    expect(ctx.voice).toBe("3");
    expect(ctx.npcs.some(n => n.wants || n.moral)).toBe(true);
    const rules = SCENE_INSTRUCTIONS.join(" ");
    expect(rules).toMatch(/не подстраиваются под героя/);
    expect(rules).toMatch(/minors true, никакого сексуального/);
    expect(rules).toMatch(/никогда не описывается/);
  });
});
