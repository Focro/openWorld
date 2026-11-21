import { describe, expect, it } from "vitest";
import { createAppearanceState } from "./appearance";
import { createInitialState, defaultWorld } from "./world";
import { createSave, importGamePayload, parseSave, serializeSave } from "./save";

describe("save appearance integrity", () => {
  it("re-locks biological appearance identity when loading a save", () => {
    const state = createInitialState(defaultWorld, "Герой");
    state.playerAppearance = createAppearanceState(
      { skinTone: 3, eyeColor: "green", naturalHairColor: "brown" },
      { hairstyle: "длинные волосы", clothing: "туника" }
    );
    const json = serializeSave(createSave(state));
    const loaded = parseSave(json);
    expect(loaded).not.toBeNull();
    const identity = loaded!.branches.main.states[0]!.playerAppearance!.identity;
    expect(Object.isFrozen(identity)).toBe(true);
    expect(identity.eyeColor).toBe("green");
  });

  it("keeps older saves without appearance fields loadable", () => {
    const state = createInitialState(defaultWorld, "Герой");
    const loaded = parseSave(serializeSave(createSave(state)));
    expect(loaded).not.toBeNull();
    expect(loaded!.branches.main.states[0]!.playerAppearance).toBeUndefined();
  });
});


describe("save format migration", () => {
  it("imports the old branch-based 0.4 save into the demo world", () => {
    const state = createInitialState(defaultWorld, "Старый герой");
    const imported = importGamePayload(serializeSave(createSave(state)), ["veloria", "demo"], "demo");
    expect(imported?.sourceFormat).toBe("legacy-branch-save");
    expect(imported?.worldId).toBe("demo");
    expect(imported?.game.playerName).toBe("Старый герой");
  });

  it("imports the current UI export without changing its selected world", () => {
    const state = createInitialState(defaultWorld, "Новый герой");
    const json = JSON.stringify({ schemaVersion: 1, worldId: "demo", game: state });
    const imported = importGamePayload(json, ["veloria", "demo"], "demo");
    expect(imported?.sourceFormat).toBe("app-export");
    expect(imported?.worldId).toBe("demo");
    expect(imported?.game.playerName).toBe("Новый герой");
  });
});

describe("память NPC не разрастается бытовыми встречами", () => {
  it("оставляет последние бытовые записи и всё значимое", async () => {
    const { compactNpcMemory, ROUTINE_MEMORY_PER_NPC } = await import("./memory");
    const routine = Array.from({ length: 50 }, (_, i) => ({ minute: i, text: `А и Б оказались рядом в локации «Двор», каждый занимаясь своим делом.`, kind: "witnessed" as const, confidence: 1 }));
    const important = { minute: 99, text: "Путник говорит: «Я из другого мира»", kind: "witnessed" as const, confidence: 1 };
    const state = { chronicle: [], npcMemory: { a: [...routine.slice(0, 25), important, ...routine.slice(25)] } } as unknown as import("./types").GameState;
    const compact = compactNpcMemory(state);
    expect(compact.npcMemory.a!.length).toBe(ROUTINE_MEMORY_PER_NPC + 1);
    expect(compact.npcMemory.a!.some(m => m.text === important.text)).toBe(true);
    expect(compact.npcMemory.a!.at(-1)!.minute).toBe(49);
  });
});
