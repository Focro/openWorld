import { describe, expect, it } from "vitest";
import { POPULATIONS, STATE_IDS, nativeFit, residentOrigin, sampleNativeAppearance } from "./populations";
import { createVeloriaWorld } from "./world";
import { MAP_NODES } from "./atlas";
import { NOBLE_HOUSES } from "./nobleHouses";
import { nobleAppearance } from "./nobleAppearance";
import { getChildAppearanceOptions } from "./heritage";
import { FAITH_INSTITUTIONS, clergyAppearance } from "./clergy";
import { FAITHS } from "./faiths";
import { COUNTRIES } from "./atlas";
import { generateVeloriaFamily } from "./familyGeneration";
import { startVeloriaCampaign } from "./campaign";
import { availableStatuses, type VeloriaCharacterDraft } from "./character";
import { applyAction, livePeriod } from "../../engine/rules";
import { presentCaregivers } from "../../engine/development";

describe("regional populations", () => {
  it("native samples always fit their own country's palette", () => {
    for (const id of STATE_IDS) for (let i = 0; i < 40; i++) expect(nativeFit(id, sampleNativeAppearance(id, `t${i}`))).toBe(1);
  });
  it("Kharum natives have east-asian features; Elyndor natives are fair", () => {
    for (let i = 0; i < 40; i++) {
      expect(sampleNativeAppearance("kharum", `k${i}`).facialFeatures).toBe("east-asian");
      expect(sampleNativeAppearance("elyndor", `e${i}`).skinTone).toBeLessThanOrEqual(2);
    }
  });
  it("foreigners are rare, more common in ports", () => {
    const share = (kind: "village" | "port") => Array.from({ length: 2000 }, (_, i) => residentOrigin("estran", `s${i}`, kind).foreign).filter(Boolean).length / 2000;
    expect(share("village")).toBeLessThan(0.03);
    expect(share("port")).toBeGreaterThan(share("village"));
    expect(share("port")).toBeLessThan(0.2);
  });
  it("settlement residents mostly look and are named like their country", () => {
    const world = createVeloriaWorld();
    let natives = 0, total = 0;
    for (const node of MAP_NODES.filter(n => n.id !== "roven")) for (const role of ["merchant", "innkeeper", "guard"]) {
      const npc = world.npcs[`${node.id}:${role}`]!;
      expect(npc.appearance).toBeDefined();
      total++; if (npc.originStateId === node.countryId) natives++;
      if (npc.originStateId === "kharum") expect(npc.appearance!.identity.facialFeatures).toBe("east-asian");
    }
    expect(natives / total).toBeGreaterThan(0.8);
  });
  it("every country has its own name pool", () => {
    const names = STATE_IDS.map(id => POPULATIONS[id].names.masculine[0]);
    expect(new Set(names).size).toBe(STATE_IDS.length);
  });
});

describe("noble appearance", () => {
  it("every house member has a stable appearance and children inherit only from parents", () => {
    for (const house of NOBLE_HOUSES) for (const member of house.members) {
      const look = nobleAppearance(member.id);
      expect(look, member.id).toBeDefined();
      const parents = member.parentIds.map(id => nobleAppearance(id));
      if (parents.length === 2 && !["rey-second-prince"].includes(member.id)) {
        const options = getChildAppearanceOptions({ id: "a", name: "a", appearance: parents[0]! }, { id: "b", name: "b", appearance: parents[1]! });
        if (!options.parentsKnown) throw new Error("parents must be known");
        expect(options.hairColors).toContain(look!.hairColor);
        expect(look!.skinTone).toBeGreaterThanOrEqual(options.skinMin);
        expect(look!.skinTone).toBeLessThanOrEqual(options.skinMax);
      }
    }
  });
  it("founders look like their country unless they came from abroad", () => {
    for (const house of NOBLE_HOUSES) for (const member of house.members) {
      if (member.parentIds.length || member.id.startsWith("rey-")) continue;
      const state = (member.originStateId ?? house.stateId) as (typeof STATE_IDS)[number];
      expect(nativeFit(state, nobleAppearance(member.id)!), member.id).toBe(1);
    }
  });
  it("keeps canonical appearance of the second prince and Eliana", () => {
    expect(nobleAppearance("rey-second-prince")).toMatchObject({ hairColor: "light-blond", eyeColor: "dark-brown", facialFeatures: "east-asian" });
    expect(nobleAppearance("rey-elin")).toMatchObject({ hairColor: "light-blond", eyeColor: "grey" });
  });
});

describe("clergy", () => {
  it("has an institution for every faith and respects canon limits", () => {
    for (const faith of FAITHS) expect(FAITH_INSTITUTIONS.some(i => i.faithId === faith.id), faith.id).toBe(true);
    for (const inst of FAITH_INSTITUTIONS) {
      expect(inst.provenance).toBe("proposal");
      expect(COUNTRIES.find(c => c.id === inst.stateId)?.primaryFaith).toBe(inst.faithId);
      if (inst.presidingId) expect(inst.persons.some(p => p.id === inst.presidingId)).toBe(true);
      expect(inst.ranks.length).toBeGreaterThanOrEqual(4);
      for (const p of inst.persons) expect(nativeFit(inst.stateId, clergyAppearance(p.id)!)).toBe(1);
    }
    // У Памяти Зелёных Рощ нет единого главы по канону.
    expect(FAITH_INSTITUTIONS.find(i => i.faithId === "green_memory")!.presidingId).toBeUndefined();
  });
});

const ATTRS = { "Сила": 15, "Выносливость": 15, "Ловкость": 14, "Интеллект": 14, "Восприятие": 14, "Харизма": 14, "Воля": 14 };
const newborn = (originId: VeloriaCharacterDraft["originId"], familySeed: string): VeloriaCharacterDraft => ({
  name: "Малыш", age: 0, originId, statusId: availableStatuses(originId)[0] ?? "marginal",
  professionId: "none", familyState: "together", startScenarioId: "ordinary", biography: "", attributes: { ...ATTRS }, familySeed
});

describe("birth into an ordinary family", () => {
  it("produces varied households from different seeds and the same family from the same seed", () => {
    const kinds = new Set<string>(), sizes = new Set<number>();
    for (let i = 0; i < 80; i++) {
      const family = generateVeloriaFamily(newborn("tenant-farmer", `seed-${i}`));
      expect(family.available).toBe(true);
      kinds.add(family.household!.kind); sizes.add(family.members.length);
    }
    expect(kinds.size).toBeGreaterThanOrEqual(5);
    expect(sizes.size).toBeGreaterThanOrEqual(4);
    expect(generateVeloriaFamily(newborn("free-farmer", "x")).summary).toBe(generateVeloriaFamily(newborn("free-farmer", "x")).summary);
  });
  it("never gives two people in one household the same first name", () => {
    for (const origin of ["tenant-farmer", "craft-apprentice", "merchant-child", "temple-orphan"] as const) for (let i = 0; i < 150; i++) {
      const given = generateVeloriaFamily(newborn(origin, `dup-${i}`)).members.map(m => m.name.split(" ")[0]);
      expect(new Set(given).size, `${origin} dup-${i}: ${given.join(", ")}`).toBe(given.length);
    }
  });
  it("refuses newborn starts in noble or adult-only origins", () => {
    expect(generateVeloriaFamily(newborn("former-soldier", "x")).available).toBe(false);
  });
  it("starts a playable newborn at home with caregivers", () => {
    let checked = 0;
    for (const origin of ["tenant-farmer", "craft-apprentice", "merchant-child", "temple-orphan"] as const) {
      const draft = newborn(origin, `start-${origin}`);
      const started = startVeloriaCampaign({ kind: "veloria-character", draft, difficultyId: "balanced" });
      if (!started.ok) { expect.soft(started.errors, origin).toEqual([]); continue; }
      const { world, state } = started;
      expect(state.development).toBeDefined();
      expect(state.inventory.swaddling_cloth).toBe(1);
      expect(presentCaregivers(world, state).length, origin).toBeGreaterThan(0);
      const exit = world.locations[state.playerLocation]!.exits[0]!;
      expect(applyAction(world, state, { type: "move", to: exit.to }).ok).toBe(false);
      expect(applyAction(world, state, { type: "infant", act: "cry" }).ok).toBe(true);
      expect(livePeriod(world, state, 30).ok).toBe(true);
      checked++;
    }
    expect(checked).toBe(4);
  }, 60_000);
});

describe("нет двойников в стартовом окружении", () => {
  it("у странника один Сержант Бран и один Элрик Данн", () => {
    const r = startVeloriaCampaign({ kind: "veloria-character", difficultyId: "balanced", draft: { name: "Путник", age: 22, originId: "wanderer", statusId: "marginal", professionId: "none", familyState: "together", startScenarioId: "ordinary", biography: "", attributes: { ...ATTRS } } });
    if (!r.ok) throw new Error(r.errors.join(" "));
    const names = Object.values(r.world.npcs).map(n => n.name);
    expect(names.filter(n => n === "Сержант Бран")).toHaveLength(1);
    expect(names.filter(n => n === "Элрик Данн")).toHaveLength(1);
  });
});
