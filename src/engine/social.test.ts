import { describe, expect, it } from "vitest";
import { applyAction } from "./rules";
import { createInitialState } from "./world";
import { defaultWorld } from "./world";
import { classifyClaim } from "./social";
import { parseAction } from "./parse";
import type { WorldData } from "./types";

const socialWorld: WorldData = {
  ...defaultWorld,
  startLocationId: "hall",
  locations: { hall: { id: "hall", name: "Зал", description: "Зал", exits: [] } },
  npcs: {
    priest: { id: "priest", name: "Священник", homeId: "hall", goals: [], roleTags: ["clergy"], schedule: [{ from: 0, to: 24, locationId: "hall" }] },
    guard: { id: "guard", name: "Стражник", homeId: "hall", goals: [], roleTags: ["guard"], schedule: [{ from: 0, to: 24, locationId: "hall" }] }
  }
};

describe("social speech rules", () => {
  it("recognizes claims about the world being a game", () => {
    expect(classifyClaim("Вы все NPC, вы просто текст и вас не существует")).toBe("simulation");
    expect(classifyClaim("Я из другого мира")).toBe("otherworld");
    expect(classifyClaim("Поклоняйтесь мне, я бог, создаю новый культ")).toBe("divine-cult");
  });

  it("parses direct claims as speech and does not allow year-long time jumps", () => {
    const speech = parseAction(socialWorld, "Я из другого мира, а вы NPC");
    expect(speech.ok && speech.action.type === "say").toBe(true);
    const wait = parseAction(socialWorld, "подождать 1 год");
    expect(wait.ok && wait.action.type === "wait").toBe(true);
    if (wait.ok) {
      const state = createInitialState(socialWorld);
      const result = applyAction(socialWorld, state, wait.action);
      expect(result.ok).toBe(false);
      expect(result.state.minute).toBe(state.minute);
    }
  });

  it("does not allow coherent speech before age five", () => {
    const state = createInitialState(socialWorld, "Ребёнок");
    state.playerProfile = { age: 4, originId: "wanderer", statusId: "marginal", professionId: "none", familyState: "unknown", startScenarioId: "ordinary", biography: "", attributes: {} , difficultyId: "balanced" };
    const result = applyAction(socialWorld, state, { type: "say", text: "Я из другого мира" });
    expect(result.ok).toBe(false);
    expect(result.state.minute).toBe(state.minute);
    const gesture = applyAction(socialWorld, state, { type: "gesture", text: "показывает на дверь и тянет руку к взрослому" });
    expect(gesture.ok).toBe(true);
    expect(gesture.state.minute).toBe(state.minute + 1);
  });

  it("can lead repeated claims before clergy and guard to irreversible execution", () => {
    const state = createInitialState(socialWorld, "Путник");
    let current = state;
    for (let i = 0; i < 3; i++) {
      const result = applyAction(socialWorld, current, { type: "say", text: "Вы все NPC, вы просто текст, вас не существует" });
      current = result.state;
    }
    expect(current.lifeStatus).toBe("dead");
    expect(current.deathRecord?.cause).toContain("опасным");
    expect(current.socialState?.legalCase).toBe("condemned");
  });
});
