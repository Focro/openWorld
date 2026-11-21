import { describe, expect, it } from "vitest";
import { ALL_RESIDENTS, RESIDENTS_BY_SETTLEMENT } from "./index";
import { MAP_NODES } from "../atlas";
import { NOBLE_HOUSES } from "../nobleHouses";
import { createVeloriaWorld } from "../world";
import { STATE_IDS } from "../populations";
import { FAITH_INSTITUTIONS } from "../clergy";
import { applyAction } from "../../../engine/rules";
import { createInitialState } from "../../../engine/world";
import { buildKnowledgeIndex } from "../../../engine/knowledge";
import { SETTLEMENT_GROUPS } from "./index";
import { spotId } from "./compact";

const world = createVeloriaWorld();
const nodeIds = new Set(MAP_NODES.map(n => n.id));
const nobleIds = new Set(NOBLE_HOUSES.flatMap(h => h.members.map(m => m.id)));
const clergyIds = new Set(FAITH_INSTITUTIONS.flatMap(f => f.persons.map(p => p.id)));
const nobleNames = new Set(NOBLE_HOUSES.flatMap(h => h.members.map(m => m.name)));
const residentIds = new Set(ALL_RESIDENTS.map(r => r.id));

describe("жители мест Ардана", () => {
  it("места жителей есть на карте, и в каждом не меньше десяти человек", () => {
    for (const [place, people] of Object.entries(RESIDENTS_BY_SETTLEMENT)) {
      expect(nodeIds.has(place), place).toBe(true);
      expect(people.length, place).toBeGreaterThanOrEqual(10);
      for (const r of people) expect(r.resident.settlementId).toBe(place);
    }
  });
  it("жители есть в каждом месте карты", () => {
    for (const node of MAP_NODES) expect(RESIDENTS_BY_SETTLEMENT[node.id]?.length ?? 0, node.id).toBeGreaterThanOrEqual(10);
  });
  it("id уникальны и не совпадают с членами домов", () => {
    expect(residentIds.size).toBe(ALL_RESIDENTS.length);
    for (const id of residentIds) expect(nobleIds.has(id), id).toBe(false);
  });
  it("день рождения в календаре мира, возраст разумный", () => {
    for (const r of ALL_RESIDENTS) {
      const { year, month, day } = r.resident.birth;
      expect(month).toBeGreaterThanOrEqual(1); expect(month).toBeLessThanOrEqual(12);
      expect(day).toBeGreaterThanOrEqual(1); expect(day).toBeLessThanOrEqual(30);
      expect(742 - year, r.id).toBeGreaterThanOrEqual(0);
      expect(742 - year, r.id).toBeLessThanOrEqual(95);
      expect(r.birthYear).toBe(year);
      expect(r.birthday).toEqual({ month, day });
    }
  });
  it("расписания и дома указывают на настоящие локации", () => {
    for (const r of ALL_RESIDENTS) {
      expect(world.locations[r.homeId], `${r.id} home`).toBeDefined();
      for (const s of r.schedule) expect(world.locations[s.locationId], `${r.id} ${s.locationId}`).toBeDefined();
    }
  });
  it("связи ведут к существующим людям, семья взаимна", () => {
    const back: Record<string, string> = { spouse: "spouse", parent: "child", child: "parent", sibling: "sibling" };
    const errors: string[] = [];
    for (const r of ALL_RESIDENTS) for (const l of r.resident.links) {
      if (!world.npcs[l.to] && !nobleIds.has(l.to) && !clergyIds.has(l.to)) errors.push(`нет человека: ${r.id} -> ${l.to}`);
      const reverse = back[l.kind];
      if (reverse && residentIds.has(l.to)) {
        const other = ALL_RESIDENTS.find(x => x.id === l.to)!;
        if (!other.resident.links.some(x => x.to === r.id && x.kind === reverse)) errors.push(`нет обратной связи: ${l.to} -> ${r.id} ${reverse}`);
      }
    }
    expect(errors).toEqual([]);
  });
  it("родители старше детей хотя бы на 15 лет", () => {
    for (const r of ALL_RESIDENTS) for (const l of r.resident.links) if (l.kind === "parent" && residentIds.has(l.to)) {
      const child = ALL_RESIDENTS.find(x => x.id === l.to)!;
      expect(child.resident.birth.year - r.resident.birth.year, `${r.id} -> ${l.to}`).toBeGreaterThanOrEqual(15);
    }
  });
  it("у каждого есть характер, привычки, речь и внешность", () => {
    for (const r of ALL_RESIDENTS) {
      expect(STATE_IDS).toContain(r.originStateId);
      expect(r.personality?.initialHabits.length, r.id).toBeGreaterThanOrEqual(2);
      expect(r.resident.speech.length, r.id).toBeGreaterThan(20);
      expect(r.resident.speech.length, r.id).toBeLessThanOrEqual(140);
      expect(r.appearance?.identity.eyeColor, r.id).toBeTruthy();
      expect(r.resident.provenance).toBe("proposal");
    }
  });
  it("приезжих мало: не больше трёх из десяти в одном месте", () => {
    for (const [place, people] of Object.entries(RESIDENTS_BY_SETTLEMENT)) {
      const node = MAP_NODES.find(n => n.id === place)!;
      const foreign = people.filter(r => r.originStateId !== node.countryId).length;
      expect(foreign / people.length, place).toBeLessThanOrEqual(0.3);
    }
  });
  it("нигде нет длинного тире", () => {
    expect(JSON.stringify(ALL_RESIDENTS)).not.toMatch(/[—–]/);
  });
  it("жители попадают в мир Велории", () => {
    for (const id of residentIds) expect(world.npcs[id], id).toBeDefined();
  });
  it("имена жителей не повторяют членов домов", () => {
    for (const r of ALL_RESIDENTS) expect(nobleNames.has(r.name), `${r.id} ${r.name}`).toBe(false);
  });
  it("в закрытые места героя не пускают, а работники там бывают", () => {
    for (const group of SETTLEMENT_GROUPS.filter(g => g.closed)) {
      const closed = world.locations[spotId(group.settlementId, "closed")];
      expect(closed?.restricted, group.settlementId).toBeTruthy();
      const state = { ...createInitialState(world), playerLocation: spotId(group.settlementId, "square") };
      const result = applyAction(world, state, { type: "move", to: closed!.id });
      expect(result.ok, group.settlementId).toBe(false);
    }
    const workers = ALL_RESIDENTS.filter(r => r.schedule.some(s => s.locationId.endsWith(":closed")));
    expect(workers.length).toBeGreaterThan(10);
  });
  it("жители не попадают в общий справочник знаний", () => {
    const ids = new Set(buildKnowledgeIndex(world).map(d => d.id));
    for (const r of ALL_RESIDENTS) expect(ids.has(`npc:${r.id}`), r.id).toBe(false);
  });
  it("тайн жителей нет в публичном коде", () => {
    for (const r of ALL_RESIDENTS) expect(r.resident.secret, r.id).toBeUndefined();
  });
});
