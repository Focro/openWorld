import { describe, expect, it } from "vitest";
import { defaultWorld } from "./world";
import { buildKnowledgeIndex, buildNpcKnowledge, buildPlayerKnowledge, retrieveKnowledge } from "./knowledge";
import { buildAiPromptEnvelope, buildNpcContext, buildPlayerContext } from "./ai";
import { createInitialState } from "./world";
import { createVeloriaWorld } from "../worlds/veloria/world";
import { createVeloriaWorldForCharacter } from "../worlds/veloria/character";

describe("grounded knowledge retrieval", () => {
  it("indexes runtime world and canonical Veloria geography", () => {
    const index = buildKnowledgeIndex(createVeloriaWorld());
    expect(index.some(item => item.id === "location:market-square")).toBe(true);
    expect(index.some(item => item.id === "country:estran")).toBe(true);
    expect(index.some(item => item.id === "settlement:roven")).toBe(true);
    expect(index.length).toBeGreaterThan(60);
  });

  it("uses the 723 KL campaign date and hides children not yet born", () => {
    const draft = { name: "Эдрен", age: 0, originId: "acknowledged-bastard" as const, statusId: "noble" as const, professionId: "none" as const, familyState: "together" as const, startScenarioId: "ordinary" as const, parentalUnionStatus: "unmarried" as const, dynasticRole: "second-prince" as const, biography: "", attributes: { "Сила": 15, "Выносливость": 15, "Ловкость": 14, "Интеллект": 14, "Восприятие": 14, "Харизма": 14, "Воля": 14 } };
    const world = createVeloriaWorldForCharacter(draft)!;
    const state = { ...createInitialState(world, "Эдрен"), worldStartYearKL: 723 };
    const futureFacts = buildPlayerKnowledge(world, state, "Марен Элиза Орен").join(" ");
    const queenFacts = buildPlayerKnowledge(world, state, "королева Элиана").join(" ");
    expect(futureFacts).not.toContain("Марен Рейнар");
    expect(futureFacts).not.toContain("Элиза Рейнар");
    expect(futureFacts).not.toContain("Орен Рейнар");
    expect(queenFacts).toContain("принцесса Элиана III");
  });
  it("gives the queen the newborn player's age and her hostile relationship", () => {
    const draft = { name: "Эдрен", age: 0, originId: "acknowledged-bastard" as const, statusId: "noble" as const, professionId: "none" as const, familyState: "together" as const, startScenarioId: "ordinary" as const, parentalUnionStatus: "unmarried" as const, dynasticRole: "second-prince" as const, biography: "", attributes: { "Сила": 15, "Выносливость": 15, "Ловкость": 14, "Интеллект": 14, "Восприятие": 14, "Харизма": 14, "Воля": 14 } };
    const world = createVeloriaWorldForCharacter(draft)!;
    const state = createInitialState(world, "Эдрен");
    state.worldStartYearKL = 723;
    state.minute = 8 * 60 + 10;
    state.playerProfile = { age: 0, originId: draft.originId, statusId: draft.statusId, professionId: draft.professionId, familyState: draft.familyState, startScenarioId: draft.startScenarioId, biography: "", attributes: draft.attributes, difficultyId: "balanced", dynasticRole: "second-prince", birthYearKL: 723 };
    state.relations["rey-elin"] = { trust: -80, sympathy: -85, fear: 12, respect: -15 };
    const queen = buildNpcContext(world, state, "rey-elin");
    expect(queen?.player.age).toBe(0);
    expect(queen?.attitudeToPlayer).toContain("неприязненно");
    expect(queen?.personality.formativeExperiences.join(" ")).toContain("измен");
  });
  it("does not attach Veloria facts to an unrelated demo world", () => {
    const index = buildKnowledgeIndex(defaultWorld);
    expect(index.some(item => item.id === "country:estran")).toBe(false);
  });

  it("returns relevant sources first and respects the character budget", () => {
    const index = buildKnowledgeIndex(createVeloriaWorld());
    const hits = retrieveKnowledge(index, "столица Эстран Коронхольм", { limit: 3, maxCharacters: 800 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some(hit => hit.id === "country:estran")).toBe(true);
    expect(hits.some(hit => hit.id === "settlement:koronholm")).toBe(true);
    expect(hits.reduce((n, hit) => n + hit.text.length + hit.title.length + hit.source.length + 24, 0)).toBeLessThanOrEqual(800);
  });

  it("retrieves relevant player memories without exposing NPC memories", () => {
    const world = structuredClone(defaultWorld);
    const state = { minute: 600, playerMemory: [{ minute: 500, text: "Я видел, как стражник у ворот задержал возчика", kind: "own" as const, confidence: 1 }], npcMemory: { marta: [{ minute: 510, text: "Тайный разговор Марты о долге", kind: "witnessed" as const, confidence: 1 }] } } as never;
    const playerFacts = buildPlayerKnowledge(world, state, "стражник задержал возчика").join(" ");
    expect(playerFacts).toContain("Я видел, как стражник");
    expect(playerFacts).not.toContain("Тайный разговор Марты");
  });

  it("retrieves only the current NPC's private memories", () => {
    const world = structuredClone(defaultWorld);
    const memory = [{ minute: 500, text: "Я слышал секрет о пропавшем обозе", kind: "heard" as const, confidence: 0.6, source: "ion" }];
    const marta = buildNpcKnowledge(world, "marta", "секрет пропавший обоз", 600, memory).join(" ");
    expect(marta).toContain("секрет о пропавшем обозе");
    const vilem = buildNpcKnowledge(world, "vilem", "секрет пропавший обоз", 600, []).join(" ");
    expect(vilem).not.toContain("секрет о пропавшем обозе");
  });

  it("does not expose another NPC's private goals", () => {
    const world = structuredClone(defaultWorld);
    world.npcs.marta!.goals = ["Скрытая цель Марты"];
    world.npcs.vilem!.goals = ["Секрет Вилема"];
    const index = buildKnowledgeIndex(world);
    index.push({ id: "private-goals:vilem", title: "Личные цели персонажа", text: "Секрет Вилема", source: "world.npcs.vilem.goals", audience: "npc", ownerId: "vilem", tags: ["секрет"] });
    const visible = retrieveKnowledge(index, "секрет цель", { audience: "npc", npcId: "marta" });
    expect(visible.some(hit => hit.text.includes("Секрет Вилема"))).toBe(false);
  });

  it("does not leak private goals into player-facing knowledge", () => {
    const world = structuredClone(defaultWorld);
    world.npcs.marta!.goals = ["Тайная цель"];
    const result = buildPlayerKnowledge(world, { minute: 500, playerLocation: "square", playerMemory: [] } as never, "цель Марты");
    expect(result.join(" ")).not.toContain("Тайная цель");
  });

  it("gives NPC retrieval its own goal while player retrieval stays public", () => {
    const world = structuredClone(defaultWorld);
    world.npcs.marta!.goals = ["Накопить на пекарню"];
    const result = buildNpcKnowledge(world, "marta", "цели пекарня", 0);
    expect(result.join(" ")).toContain("Накопить на пекарню");
  });
});


describe("AI-ready context contract", () => {
  it("includes the full in-world date and retrieved evidence for the player", () => {
    const world = createVeloriaWorld();
    const state = createInitialState(world, "Тестовый игрок");
    const context = buildPlayerContext(world, state, 10, "столица Эстран");
    expect(context.time).toContain("742 КЛ");
    expect(context.worldKnowledge.some(item => item.includes("atlas.countries.estran"))).toBe(true);
    expect(context.groundingRules.length).toBeGreaterThan(0);
    expect(context.resources.money).toBe(12);
    expect(context.availableExits.length).toBeGreaterThan(0);
  });

  it("builds an NPC-specific context and a provider-neutral prompt envelope", () => {
    const world = createVeloriaWorld();
    const state = createInitialState(world, "Тестовый игрок");
    const npc = buildNpcContext(world, state, "marta");
    expect(npc).not.toBeNull();
    expect(npc!.time).toContain("742 КЛ");
    expect(npc!.goals).toEqual(world.npcs.marta!.goals);
    const player = buildPlayerContext(world, state, 10, "Ровен");
    const envelope = buildAiPromptEnvelope(player, "Осмотрись");
    expect(envelope.protocol).toBe("openworld-ai-context-v1");
    expect(envelope.outputContract.allowedActions).toContain("move");
  });
});
