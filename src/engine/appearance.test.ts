import { describe, expect, it } from "vitest";
import {
  applyAppearanceChange, createAppearanceState, describeAppearance, observeAppearance, validateAppearanceIdentity, isHaircutDescriptionAllowed, isNonInheritedAppearanceDescriptionAllowed
} from "./appearance";
import { applyAction, updateNpcAppearance, updatePlayerAppearance } from "./rules";
import { parseAction } from "./parse";
import { createInitialState, defaultWorld } from "./world";
import { buildNpcContext, buildPlayerContext } from "./ai";
import type { WorldData } from "./types";

const initialAppearance = () => createAppearanceState(
  { skinTone: 3, eyeColor: "green", naturalHairColor: "brown", hairTexture: "wavy", facialFeatures: "soft" },
  { hairstyle: "длинные волосы до плеч", clothing: "синяя туника" }
);

describe("persistent character appearance", () => {
  it("does not allow free-form appearance notes to bypass inherited traits", () => {
    expect(isNonInheritedAppearanceDescriptionAllowed("родинка на шее и веснушки")).toBe(true);
    expect(isNonInheritedAppearanceDescriptionAllowed("тёмная кожа и голубые глаза")).toBe(false);
    expect(isNonInheritedAppearanceDescriptionAllowed("голубые глаза")).toBe(false);
    expect(isNonInheritedAppearanceDescriptionAllowed("чёрные волосы")).toBe(false);
    expect(isNonInheritedAppearanceDescriptionAllowed("азиатские черты лица")).toBe(false);
    expect(() => createAppearanceState({ description: "чёрные волосы и серые глаза" }, { hairstyle: "длинные волосы", clothing: "рубаха" })).toThrow();
  });

  it("rejects invalid inherited identity data", () => {
    expect(validateAppearanceIdentity({ skinTone: 11, eyeColor: "x".repeat(50) }).length).toBeGreaterThan(0);
  });

  it("renders inherited appearance codes as Russian descriptions for NPCs and the player", () => {
    const state = createAppearanceState({ skinTone: 3, eyeColor: "hazel", naturalHairColor: "dark-brown", hairTexture: "wavy", facialFeatures: "angular" }, { hairstyle: "волосы убраны", clothing: "туника" });
    const description = describeAppearance(state);
    expect(description).toContain("глаза: ореховые");
    expect(description).toContain("природные волосы: тёмно-каштановые");
    expect(description).toContain("текстура волос: волнистые");
    expect(description).toContain("черты лица: угловатые");
    expect(description).not.toContain("dark-brown");
  });

  it("freezes the biological identity object at runtime", () => {
    const appearance = initialAppearance();
    expect(Object.isFrozen(appearance.identity)).toBe(true);
  });

  it("allows haircut and clothing changes without changing inherited traits", () => {
    const before = initialAppearance();
    const after = applyAppearanceChange(before, { type: "haircut", hairstyle: "короткая стрижка" })!;
    expect(after.hairstyle).toBe("короткая стрижка");
    expect(after.identity).toEqual(before.identity);
    expect(after.identity.eyeColor).toBe("green");
    expect(after.identity.skinTone).toBe(3);
  });

  it("does not allow a wound to heal before it was received", () => {
    const wounded = applyAppearanceChange(initialAppearance(), {
      type: "get-wounded", wound: { id: "w2", description: "порез", location: "рука", leavesScar: true, receivedAt: 100 }
    })!;
    expect(applyAppearanceChange(wounded, { type: "heal-wound", woundId: "w2", healedAt: 99 })).toBeNull();
  });

  it("turns a scar-forming wound into a permanent scar after healing", () => {
    const wounded = applyAppearanceChange(initialAppearance(), {
      type: "get-wounded", wound: { id: "w1", description: "рваная рана", location: "левая щека", leavesScar: true, receivedAt: 100 }
    })!;
    expect(wounded.wounds).toHaveLength(1);
    const healed = applyAppearanceChange(wounded, { type: "heal-wound", woundId: "w1", healedAt: 180 })!;
    expect(healed.wounds).toHaveLength(0);
    expect(healed.scars).toHaveLength(1);
    expect(healed.scars[0]?.permanent).toBe(true);
    expect(describeAppearance(healed)).toContain("левая щека");
  });

  it("does not update an observer's remembered look until they see the character again", () => {
    const first = initialAppearance();
    const memory = observeAppearance("npc-1", "player", 10, "square", first);
    const changed = applyAppearanceChange(first, { type: "haircut", hairstyle: "коротко" })!;
    expect(memory.snapshot).toContain("длинные волосы до плеч");
    expect(memory.snapshot).not.toContain("коротко");
    const seenAgain = observeAppearance("npc-1", "player", 50, "market", changed);
    expect(seenAgain.snapshot).toContain("коротко");
    expect(seenAgain.observedAt).toBe(50);
  });

  it("clears old garment defects when the character changes clothes", () => {
    const wrinkled = applyAppearanceChange(initialAppearance(), { type: "set-clothing-condition", condition: "wrinkled", active: true })!;
    const changed = applyAppearanceChange(wrinkled, { type: "change-clothing", clothing: "чистый дорожный плащ" })!;
    expect(changed.clothing).toBe("чистый дорожный плащ");
    expect(changed.clothingConditions).toEqual([]);
  });

  it("remains compatible with saves created before clothing conditions existed", () => {
    const oldSaveAppearance = { ...initialAppearance(), clothingConditions: undefined } as unknown as ReturnType<typeof initialAppearance>;
    expect(describeAppearance(oldSaveAppearance)).toContain("синяя туника");
    const updated = applyAppearanceChange(oldSaveAppearance, { type: "set-clothing-condition", condition: "wrinkled", active: true });
    expect(updated?.clothingConditions).toEqual(["wrinkled"]);
  });

  it("stores visible clothing conditions in the appearance snapshot", () => {
    const initial = initialAppearance();
    const wrinkled = applyAppearanceChange(initial, { type: "set-clothing-condition", condition: "wrinkled", active: true })!;
    const snapshot = describeAppearance(wrinkled);
    expect(snapshot).toContain("одежда: синяя туника");
    expect(snapshot).toContain("помята");
    const repaired = applyAppearanceChange(wrinkled, { type: "set-clothing-condition", condition: "wrinkled", active: false })!;
    expect(describeAppearance(repaired)).not.toContain("помята");
  });

  it("does not let a haircut command disguise hair dye as a hairstyle change", () => {
    expect(isHaircutDescriptionAllowed("короткая стрижка")).toBe(true);
    expect(isHaircutDescriptionAllowed("покрасить волосы в белый")).toBe(false);
    expect(isHaircutDescriptionAllowed("короткая стрижка с белыми прядями")).toBe(false);
    expect(applyAppearanceChange(initialAppearance(), { type: "haircut", hairstyle: "перекрасить волосы в блонд" })).toBeNull();
    const world: WorldData = { ...defaultWorld, startLocationId: "square" };
    expect(parseAction(world, "постричься и покраситься в блонд").ok).toBe(false);
    const clothing = parseAction(world, "помять одежду");
    expect(clothing.ok).toBe(true);
    if (clothing.ok) expect(clothing.action.type).toBe("clothing-condition");
  });

  it("does not allow commands to rewrite biological skin or eye colour", () => {
    const world: WorldData = { ...defaultWorld, startLocationId: "square" };
    for (const command of ["изменить цвет кожи на другой", "сменить цвет глаз на красный", "я стал белым", "я стал чёрным"]) {
      expect(parseAction(world, command).ok).toBe(false);
    }
  });

  it("routes a haircut through the game rules and updates only current hairstyle", () => {
    const world: WorldData = { ...defaultWorld, startLocationId: "square" };
    const state = createInitialState(world, "Герой");
    state.playerAppearance = initialAppearance();
    const parsed = parseAction(world, "постричься коротко");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = applyAction(world, state, parsed.action);
    expect(result.ok).toBe(true);
    expect(result.state.playerAppearance?.hairstyle).toBe("коротко");
    expect(result.state.playerAppearance?.identity.eyeColor).toBe("green");
    expect(result.state.playerAppearance?.identity.skinTone).toBe(3);
  });

  it("tells the AI not to invent an NPC appearance when canon has no profile", () => {
    const state = createInitialState(defaultWorld, "Герой");
    const context = buildPlayerContext(defaultWorld, state);
    expect(context.presentNpcAppearances?.every(item => item.appearance?.includes("не установлена каноническими данными"))).toBe(true);
  });

  it("stores the current appearance snapshot only for NPCs who witness an event", () => {
    const world: WorldData = {
      ...defaultWorld,
      startLocationId: "hall",
      locations: { hall: { id: "hall", name: "Зал", description: "Зал", exits: [] } },
      npcs: {
        witness: { id: "witness", name: "Очевидец", homeId: "hall", goals: [], schedule: [{ from: 0, to: 24, locationId: "hall" }] },
        absent: { id: "absent", name: "Отсутствующий", homeId: "elsewhere", goals: [], schedule: [] }
      }
    };
    const state = createInitialState(world, "Герой");
    state.playerAppearance = initialAppearance();
    const result = applyAction(world, state, { type: "wait", minutes: 1 });
    expect(result.state.npcAppearanceObservations?.witness?.snapshot).toContain("зелёные глаза");
    expect(result.state.npcAppearanceObservations?.absent).toBeUndefined();
  });

  it("turns a witnessed wound into a persistent scar after healing", () => {
    const world: WorldData = {
      ...defaultWorld, startLocationId: "hall",
      locations: { hall: { id: "hall", name: "Зал", description: "Зал", exits: [] } },
      npcs: { witness: { id: "witness", name: "Очевидец", homeId: "hall", goals: [], schedule: [{ from: 0, to: 24, locationId: "hall" }] } }
    };
    const state = createInitialState(world, "Герой");
    state.playerAppearance = initialAppearance();
    const wounded = updatePlayerAppearance(world, state, {
      type: "get-wounded", wound: { id: "cut-1", description: "порез", location: "левая щека", leavesScar: true, receivedAt: state.minute }
    }, "Герой получает порез на левой щеке.");
    expect(wounded.ok).toBe(true);
    expect(wounded.state.playerAppearance?.wounds).toHaveLength(1);
    expect(wounded.state.npcAppearanceObservations?.witness?.snapshot).toContain("незажившие раны");
    const premature = updatePlayerAppearance(world, wounded.state, { type: "heal-wound", woundId: "cut-1", healedAt: wounded.state.minute + 60 }, "Слишком раннее лечение.");
    expect(premature.ok).toBe(false);
    const beforeHealing = { ...wounded.state, minute: wounded.state.minute + 60 };
    const healed = updatePlayerAppearance(world, beforeHealing, { type: "heal-wound", woundId: "cut-1", healedAt: beforeHealing.minute }, "Порез на щеке зажил, оставив шрам.");
    expect(healed.ok).toBe(true);
    expect(healed.state.playerAppearance?.wounds).toHaveLength(0);
    expect(healed.state.playerAppearance?.scars).toHaveLength(1);
    expect(healed.state.playerAppearance?.scars[0]?.permanent).toBe(true);
    expect(healed.state.playerAppearance?.identity.eyeColor).toBe("green");
  });
});


describe("two-way appearance observation", () => {
  it("lets the player remember an NPC appearance after personally seeing them", () => {
    const world: WorldData = {
      ...defaultWorld, startLocationId: "hall",
      locations: { hall: { id: "hall", name: "Зал", description: "Зал", exits: [] } },
      npcs: {
        visible: { id: "visible", name: "Видимый NPC", homeId: "hall", goals: [], schedule: [{ from: 0, to: 24, locationId: "hall" }], appearance: initialAppearance() }
      }
    };
    const state = createInitialState(world, "Герой");
    const result = applyAction(world, state, { type: "look" });
    expect(result.state.appearanceObservations?.player?.visible?.snapshot).toContain("зелёные глаза");
  });

  it("updates an NPC hairstyle and informs only people who witness the change", () => {
    const world: WorldData = {
      ...defaultWorld, startLocationId: "hall",
      locations: { hall: { id: "hall", name: "Зал", description: "Зал", exits: [] }, elsewhere: { id: "elsewhere", name: "В другом месте", description: "Далеко", exits: [] } },
      npcs: {
        subject: { id: "subject", name: "Персонаж", homeId: "hall", goals: [], schedule: [{ from: 0, to: 24, locationId: "hall" }], appearance: initialAppearance() },
        witness: { id: "witness", name: "Очевидец", homeId: "hall", goals: [], schedule: [{ from: 0, to: 24, locationId: "hall" }] },
        absent: { id: "absent", name: "Отсутствующий", homeId: "elsewhere", goals: [], schedule: [{ from: 0, to: 24, locationId: "elsewhere" }] }
      }
    };
    const state = createInitialState(world, "Герой");
    const result = updateNpcAppearance(world, state, "subject", { type: "haircut", hairstyle: "короткая стрижка" }, "Персонаж постригся.");
    expect(result.ok).toBe(true);
    expect(result.state.npcAppearances?.subject?.hairstyle).toBe("короткая стрижка");
    expect(result.state.npcAppearances?.subject?.identity.eyeColor).toBe("green");
    expect(result.state.appearanceObservations?.witness?.subject?.snapshot).toContain("короткая стрижка");
    expect(result.state.appearanceObservations?.player?.subject?.snapshot).toContain("короткая стрижка");
    expect(result.state.appearanceObservations?.absent?.subject).toBeUndefined();
    const context = buildNpcContext(world, result.state, "witness");
    expect(context?.knownAppearanceObservations?.[0]?.snapshot).toContain("короткая стрижка");
  });
});
