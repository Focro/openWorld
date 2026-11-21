import { describe, expect, it } from "vitest";
import {
  MILESTONES, MINUTES_PER_YEAR, NEUTRAL_TEMPERAMENT, ageMonths, applyLossOfAttachment, capabilities, computePace,
  createDevelopment, ensureDevelopment, memoryFraming, lifeStageForMonths
} from "./development";
import { applyAction, livePeriod } from "./rules";
import { parseAction } from "./parse";
import { advanceWorldTime } from "./timeflow";
import { allowedActionsFor, resolveWithAi } from "./ai";
import { npcLocation } from "./world";
import { startVeloriaCampaign, type VeloriaCampaignRecipe } from "../worlds/veloria/campaign";
import { migrateStateForWorld } from "../worlds/registry";
import type { GameState } from "./types";

const ATTRS = { "Сила": 15, "Выносливость": 15, "Ловкость": 14, "Интеллект": 14, "Восприятие": 14, "Харизма": 14, "Воля": 14 };
const DAY = 1440;

function princeRecipe(name = "Эдрен"): VeloriaCampaignRecipe {
  return { kind: "veloria-character", difficultyId: "balanced", draft: {
    name, age: 0, originId: "acknowledged-bastard", statusId: "noble", professionId: "none", familyState: "together", startScenarioId: "ordinary",
    parentalUnionStatus: "unmarried", dynasticRole: "second-prince", biography: "", attributes: { ...ATTRS }
  } };
}
function startPrince(name?: string) {
  const started = startVeloriaCampaign(princeRecipe(name));
  if (!started.ok) throw new Error(started.errors.join(" "));
  return started;
}
function liveDays(world: Parameters<typeof livePeriod>[0], state: GameState, days: number): GameState {
  let current = state;
  let left = days;
  while (left > 0) {
    const before = current.minute;
    const r = livePeriod(world, current, Math.min(left, 365));
    if (!r.ok) throw new Error(r.message);
    current = r.state;
    left -= Math.max(1, Math.round((current.minute - before) / DAY));
  }
  return current;
}

describe("life stages and capabilities", () => {
  it("maps ages to stages in order", () => {
    expect(lifeStageForMonths(0).id).toBe("infancy");
    expect(lifeStageForMonths(20).id).toBe("early-childhood");
    expect(lifeStageForMonths(100).id).toBe("childhood");
    expect(lifeStageForMonths(150).id).toBe("adolescence");
    expect(lifeStageForMonths(200).id).toBe("youth");
    expect(lifeStageForMonths(300).id).toBe("adulthood");
    expect(lifeStageForMonths(800).id).toBe("elder");
  });

  it("a newborn cannot talk, walk or trade; an adult start has milestones passed", () => {
    const newborn = createDevelopment({ birthMinute: 0, nowMinute: 0, aptitudes: ATTRS, seed: "a" });
    const caps = capabilities(newborn, 0);
    expect(caps.maxWordsPerUtterance).toBe(0);
    expect(caps.canWalk).toBe(false);
    expect(caps.canTrade).toBe(false);
    expect(caps.infantActions).toContain("cry");
    const adult = createDevelopment({ birthMinute: 0, nowMinute: 25 * MINUTES_PER_YEAR, aptitudes: ATTRS, seed: "b" });
    const adultCaps = capabilities(adult, 25 * MINUTES_PER_YEAR);
    expect(adultCaps.maxWordsPerUtterance).toBe(Infinity);
    expect(adultCaps.canWalk && adultCaps.canTrade).toBe(true);
    expect(Object.keys(adult.milestones)).toHaveLength(MILESTONES.length);
  });

  it("individual pace differs between children but stays in a plausible range", () => {
    const a = computePace(ATTRS, NEUTRAL_TEMPERAMENT, "seed-a");
    const b = computePace({ ...ATTRS, "Интеллект": 18, "Ловкость": 8 }, NEUTRAL_TEMPERAMENT, "seed-b");
    expect(a).not.toEqual(b);
    for (const v of [...Object.values(a), ...Object.values(b)]) { expect(v).toBeGreaterThan(0.75); expect(v).toBeLessThan(1.3); }
  });

  it("infantile amnesia frames early memories as uncertain", () => {
    const baby = createDevelopment({ birthMinute: 0, nowMinute: 0, aptitudes: ATTRS, seed: "c" });
    const framed = memoryFraming(baby, "Тёплые руки");
    expect(framed.confidence).toBeLessThan(0.5);
    expect(framed.text).toContain("Тёплые руки");
    expect(memoryFraming(undefined, "x").confidence).toBe(1);
  });

  it("losing an attachment is recorded and marks the person as lost", () => {
    const baby = createDevelopment({ birthMinute: 0, nowMinute: 0, aptitudes: ATTRS, seed: "d" });
    baby.attachments.mom = { security: 40, familiarity: 40, wariness: 0, lastContactMinute: 0 };
    const after = applyLossOfAttachment(baby, "mom", "Мама", 100);
    expect(after.attachments.mom?.lost).toBe(true);
    expect(after.experiences.length).toBeGreaterThan(baby.experiences.length);
  });
});

describe("second prince from birth", () => {
  it("starts as a newborn in the nursery with no unborn siblings in the world yet", () => {
    const { world, state } = startPrince();
    expect(state.development).toBeDefined();
    expect(ageMonths(state.development!, state.minute)).toBeLessThan(0.1);
    expect(state.playerLocation).toBe("rey:royal-nursery");
    expect(state.development!.attachments["rey-second-prince-mother"]).toBeDefined();
    const unborn = Object.values(world.npcs).filter(npc => npc.bornAtMinute !== undefined && npc.bornAtMinute > state.minute);
    expect(unborn.length).toBeGreaterThan(0);
    for (const npc of unborn) expect(npcLocation(world, npc.id, state.minute, state.npcDeaths)).toBeNull();
  });

  it("an infant cannot walk away, speak sentences or buy, but can use infant acts", () => {
    const { world, state } = startPrince();
    const exit = world.locations[state.playerLocation]!.exits[0]!;
    expect(applyAction(world, state, { type: "move", to: exit.to }).ok).toBe(false);
    expect(applyAction(world, state, { type: "say", text: "Я хочу к отцу немедленно" }).ok).toBe(false);
    const cry = applyAction(world, state, { type: "infant", act: "cry" });
    expect(cry.ok).toBe(true);
    expect(cry.state.minute).toBeGreaterThan(state.minute);
    expect(allowedActionsFor(state)).not.toContain("move");
    expect(allowedActionsFor(state)).toContain("infant:cry");
  });

  it("reaches milestones in order while growing and never skips a world event", () => {
    const { world, state } = startPrince();
    const oneYear = liveDays(world, state, 365);
    const dev = oneYear.development!;
    expect(dev.milestones["social-smile"]).toBeDefined();
    expect(dev.physical.heightCm).toBeGreaterThan(65);
    // Порядок вех внутри одной области развития: более поздняя не наступает раньше ранней.
    for (const a of MILESTONES) for (const b of MILESTONES) {
      if (a.domain !== b.domain || a.typicalMonths >= b.typicalMonths) continue;
      const atB = dev.milestones[b.id];
      if (atB === undefined) continue;
      expect(dev.milestones[a.id]).toBeDefined();
      expect(dev.milestones[a.id]!).toBeLessThanOrEqual(atB);
    }
  }, 60_000);

  it("living a long period stops at the important event instead of skipping it", () => {
    const { world, state } = startPrince();
    const near = { ...state, development: { ...state.development!, milestones: Object.fromEntries(MILESTONES.map(m => [m.id, state.minute])) } };
    // Вехи сняты как повод для остановки: остаются только события мира (рождение Марена в 724 КЛ).
    let current: GameState = near;
    let birthSeen = false;
    for (let i = 0; i < 3 && !birthSeen; i++) {
      const r = livePeriod(world, current, 365);
      current = r.state;
      birthSeen = r.message.toLowerCase().includes("родил");
      if (birthSeen) expect(r.message).toContain("Время остановлено");
    }
    expect(birthSeen).toBe(true);
  }, 60_000);

  it("save migration restores campaign recipe and development for legacy prince saves", () => {
    const { state } = startPrince();
    const legacy = structuredClone(state) as GameState;
    delete legacy.campaign; delete legacy.development;
    const migrated = migrateStateForWorld("veloria", legacy);
    expect(migrated.campaign?.worldId).toBe("veloria");
    expect(migrated.development).toBeDefined();
    expect(ensureDevelopment(migrated)).toBeDefined();
  });

  it("time advance keeps the world event list processed exactly once", () => {
    const { world, state } = startPrince();
    const a = advanceWorldTime(world, state, state.minute + 13 * 365 * DAY).state;
    const accession = a.chronicle.filter(e => e.text.includes("735"));
    expect(accession.length).toBeGreaterThan(0);
    const b = advanceWorldTime(world, a, a.minute + DAY).state;
    expect(b.chronicle.filter(e => e.text.includes("735")).length).toBe(accession.length);
  }, 60_000);
});

describe("parsing life commands", () => {
  it("parses infant verbs and live periods", () => {
    const { world } = startPrince();
    expect(parseAction(world, "плакать")).toEqual({ ok: true, action: { type: "infant", act: "cry" } });
    expect(parseAction(world, "прожить неделю")).toEqual({ ok: true, action: { type: "live", days: 7 } });
    expect(parseAction(world, "прожить 3 дня")).toEqual({ ok: true, action: { type: "live", days: 3 } });
    expect(parseAction(world, "прожить год")).toEqual({ ok: true, action: { type: "live", days: 365 } });
  });
});

describe("AI proposals are checked against age", () => {
  it("rejects an action the infant cannot do and applies an allowed one", async () => {
    const { world, state } = startPrince();
    const exit = world.locations[state.playerLocation]!.exits[0]!;
    const bad = await resolveWithAi(world, state, "убежать", { propose: async () => ({ type: "move", to: exit.to }) });
    expect(bad.ok).toBe(false);
    expect(bad.state).toBe(state);
    const good = await resolveWithAi(world, state, "поплакать", { propose: async () => ({ type: "infant", act: "cry" }) });
    expect(good.ok).toBe(true);
    const broken = await resolveWithAi(world, state, "x", { propose: async () => { throw new Error("offline"); } });
    expect(broken.ok).toBe(false);
  });
});

describe("прожить период без лишних остановок", () => {
  it("склоняет дни правильно", async () => {
    const { pluralDays } = await import("./rules");
    expect([1, 3, 11, 21, 41, 56, 112, 365].map(n => `${n} ${pluralDays(n)}`)).toEqual(["1 день", "3 дня", "11 дней", "21 день", "41 день", "56 дней", "112 дней", "365 дней"]);
  });
  it("год в младенчестве проживается целиком, а вехи перечисляются в итоге", async () => {
    const { startVeloriaCampaign } = await import("../worlds/veloria/campaign");
    const ATTRS = { "Сила": 15, "Выносливость": 15, "Ловкость": 14, "Интеллект": 14, "Восприятие": 14, "Харизма": 14, "Воля": 14 };
    const r = startVeloriaCampaign({ kind: "veloria-character", difficultyId: "balanced", draft: { name: "Малыш", age: 0, originId: "tenant-farmer", statusId: "rural-free", professionId: "none", familyState: "together", startScenarioId: "ordinary", biography: "", attributes: { ...ATTRS }, familySeed: "year" } });
    if (!r.ok) throw new Error(r.errors.join(" "));
    const lived = livePeriod(r.world, r.state, 365);
    expect(lived.message).toContain("Проходит 365 дней");
    expect(lived.message).toContain("Новая веха развития");
  }, 60_000);
});
