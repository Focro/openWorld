import { describe, expect, it } from "vitest";
import { recallFor, RECALL_CHARS, RECALL_LIMIT } from "./recall";
import { buildSceneContext } from "./speech";
import { npcsAt } from "./world";
import { startVeloriaCampaign } from "../worlds/veloria/campaign";
import type { ChronicleEntry, GameState, MemoryEntry } from "./types";

const DAY = 1440;
const ATTRS = { "Сила": 15, "Выносливость": 15, "Ловкость": 14, "Интеллект": 14, "Восприятие": 14, "Харизма": 14, "Воля": 14 };

/** Лента одного человека: события героя, сцены при нём и фон. */
function withTape(state: GameState, npcId: string, tape: { text: string; minute: number; source: ChronicleEntry["source"]; routine?: true; withHero?: true }[]): GameState {
  const chronicle: ChronicleEntry[] = [...state.chronicle];
  const memory: MemoryEntry[] = [];
  for (const item of tape) {
    const id = `t${chronicle.length + 1}`;
    chronicle.push({ id, minute: item.minute, locationId: "elsewhere", text: item.text, witnesses: [npcId], source: item.source, ...(item.routine ? { routine: true as const } : {}), ...(item.withHero ? { withHero: true as const } : {}) });
    memory.push({ minute: item.minute, text: item.text, kind: "witnessed", confidence: 1, eventId: id });
  }
  return { ...state, chronicle, npcMemory: { ...state.npcMemory, [npcId]: memory } };
}

const base = { schemaVersion: 1, playerName: "Ирина", minute: 200 * DAY, playerLocation: "here", money: 0, inventory: {}, chronicle: [], playerMemory: [], npcMemory: {}, relations: {} } as unknown as GameState;
const filler = (from: number, count: number) => Array.from({ length: count }, (_, i) => ({ text: `Мара видит, как у колодца меняют ведро номер ${i}.`, minute: from + i * 10, source: { kind: "system" as const } }));

describe("память NPC к ходу: отбор, а не хвост", () => {
  it("старый отказ через сотню записей снова попадает в mem, пока не закрыт", () => {
    const state = withTape(base, "mara", [
      { text: "Ирина говорит: «Я люблю тебя, Мара»", minute: 10 * DAY, source: { kind: "player" } },
      { text: "Мара: «Нет. Я отказываю тебе, не ходи за мной»", minute: 10 * DAY + 1, source: { kind: "npc", id: "mara" }, withHero: true },
      ...filler(20 * DAY, 150)
    ]);
    const mem = recallFor(state, "mara", "Доброе утро");
    expect(mem.some(line => line.includes("отказываю"))).toBe(true);
    expect(mem.some(line => line.includes("люблю тебя"))).toBe(true);
    // Свежее дело тоже есть, чтобы речь была про сегодня.
    expect(mem.some(line => line.includes("номер 149"))).toBe(true);
    // Порядок хронологический, старое помечено давностью.
    expect(mem[0]).toMatch(/^\d+ мес\. назад: /);
  });

  it("закрытая метка уступает: после «вернула долг» старый долг не висит открытым", () => {
    const state = withTape(base, "mara", [
      { text: "Ирина говорит: «Одолжи мне серебра, верну в долг через неделю»", minute: 5 * DAY, source: { kind: "player" } },
      ...filler(6 * DAY, 30),
      { text: "Ирина вернула долг Маре, они в расчете.", minute: 50 * DAY, source: { kind: "player" } },
      ...filler(60 * DAY, 30)
    ]);
    const mem = recallFor(state, "mara", "Как дела?");
    expect(mem.some(line => line.includes("в расчете"))).toBe(true);
    expect(mem.some(line => line.includes("Одолжи"))).toBe(false);
  });

  it("слова игрока поднимают старую запись: «у ворот»", () => {
    const state = withTape(base, "mara", [
      { text: "Мара видит, как у северных ворот стражник берёт мзду с возчика.", minute: 3 * DAY, source: { kind: "system" } },
      ...filler(10 * DAY, 80)
    ]);
    expect(recallFor(state, "mara", "Привет").some(line => line.includes("ворот"))).toBe(false);
    expect(recallFor(state, "mara", "Что было у ворот?").some(line => line.includes("ворот"))).toBe(true);
  });

  it("чужие слухи и фон не становятся «видел сам»; лимиты 6 строк по 120 знаков", () => {
    const long = "Ирина ударила Мару по лицу при всех на площади, и люди долго это обсуждали, вспоминая каждую мелочь того дня и её злое лицо.";
    let state = withTape(base, "mara", [
      { text: long, minute: 2 * DAY, source: { kind: "player" } },
      { text: "Ирина и Мара оказались рядом в локации «Рынок», каждый занимаясь своим делом.", minute: 3 * DAY, source: { kind: "npc", id: "mara" }, routine: true },
      ...filler(4 * DAY, 40)
    ]);
    // Слух о долге героя: Мара его не видела.
    state = { ...state, npcMemory: { mara: [...state.npcMemory.mara!, { minute: 100 * DAY, text: "Говорят, Ирина взяла в долг у ростовщика", kind: "heard", confidence: 0.5 }, ...state.npcMemory.mara!.slice(-3)] } };
    const mem = recallFor(state, "mara", "удар долг ворота рынок ведро");
    expect(mem.length).toBeLessThanOrEqual(RECALL_LIMIT);
    expect(mem.length).toBeGreaterThanOrEqual(4);
    for (const line of mem) expect(line.length).toBeLessThanOrEqual(RECALL_CHARS);
    expect(mem.some(line => line.includes("ударила"))).toBe(true);
    expect(mem.some(line => line.includes("оказались рядом"))).toBe(false);
  });

  it("buildSceneContext кладёт отбор в mem, recent не меняется", () => {
    const r = startVeloriaCampaign({ kind: "veloria-character", difficultyId: "balanced", draft: { name: "Ирина", age: 24, originId: "merchant-child", statusId: "guild-free", professionId: "merchant", familyState: "together", startScenarioId: "ordinary", biography: "", attributes: { ...ATTRS } } });
    if (!r.ok) throw new Error(r.errors.join(" "));
    let state = r.state;
    const world = r.world;
    found: for (let hour = 0; hour < 24; hour++) for (const id of Object.keys(world.locations)) {
      const minute = state.minute + hour * 60;
      if (npcsAt(world, minute, id, state.npcDeaths).length) { state = { ...state, minute, playerLocation: id }; break found; }
    }
    const npcId = npcsAt(world, state.minute, state.playerLocation, state.npcDeaths)[0]!;
    const before = buildSceneContext(world, state, "привет");
    state = withTape(state, npcId, [
      { text: "Ирина говорит: «Ты солгал мне про цену»", minute: state.minute - 40 * DAY, source: { kind: "player" } },
      ...filler(state.minute - 30 * DAY, 120)
    ]);
    const ctx = buildSceneContext(world, state, "привет");
    const mem = ctx.npcs.find(n => n.id === npcId)!.mem ?? [];
    expect(mem.some(line => line.includes("солгал"))).toBe(true);
    expect(mem.length).toBeLessThanOrEqual(6);
    expect(ctx.recent).toEqual(before.recent);
  });
});
