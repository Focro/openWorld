import { describe, expect, it } from "vitest";
import { ageFromBirthDate, hasSexualIntent, isChildSafetyViolation, localSafetyStore, registerViolation, SAFETY_WARNINGS_BEFORE_BAN } from "./safety";
import { startVeloriaCampaign } from "../worlds/veloria/campaign";
import { npcsAt } from "./world";
import type { GameState, NpcDef, WorldData } from "./types";

const ATTRS = { "Сила": 15, "Выносливость": 15, "Ловкость": 14, "Интеллект": 14, "Восприятие": 14, "Харизма": 14, "Воля": 14 };
function adult(): { world: WorldData; state: GameState } {
  const r = startVeloriaCampaign({ kind: "veloria-character", difficultyId: "balanced", draft: { name: "Ирина", age: 24, originId: "merchant-child", statusId: "guild-free", professionId: "merchant", familyState: "together", startScenarioId: "ordinary", biography: "", attributes: { ...ATTRS } } });
  if (!r.ok) throw new Error(r.errors.join(" "));
  return { world: r.world, state: r.state };
}
class Mem { data = new Map<string, string>(); getItem(k: string) { return this.data.get(k) ?? null; } setItem(k: string, v: string) { this.data.set(k, v); } }

describe("возраст по дате рождения", () => {
  const today = new Date(2026, 10, 21);
  it("считает полные годы на сегодня", () => {
    expect(ageFromBirthDate("2008-11-21", today)).toBe(18);
    expect(ageFromBirthDate("2008-11-22", today)).toBe(17);
    expect(ageFromBirthDate("1990-01-01", today)).toBe(36);
  });
  it("отбрасывает неверные даты", () => {
    expect(ageFromBirthDate("2008-02-30", today)).toBeNull();
    expect(ageFromBirthDate("завтра", today)).toBeNull();
    expect(ageFromBirthDate("2030-01-01", today)).toBeNull();
  });
});

describe("защита детей-персонажей", () => {
  const { world, state } = adult();
  // Ставим ребёнка туда же, где взрослый NPC, чтобы он точно был рядом.
  let busy = state;
  outer: for (let h = 0; h < 24; h++) for (const id of Object.keys(world.locations)) {
    const minute = state.minute + h * 60;
    if (npcsAt(world, minute, id, state.npcDeaths).length) { busy = { ...state, minute, playerLocation: id }; break outer; }
  }
  const host = world.npcs[npcsAt(world, busy.minute, busy.playerLocation, busy.npcDeaths)[0]!]!;
  const kid: NpcDef = { id: "kid", name: "Лина", age: 9, homeId: host.homeId, goals: [], schedule: host.schedule, lifeSchedules: host.lifeSchedules };
  const withKid: WorldData = { ...world, npcs: { ...world.npcs, kid } };

  it("распознаёт сексуальное намерение и не трогает обычные слова", () => {
    expect(hasSexualIntent("раздеваю её догола")).toBe(true);
    expect(hasSexualIntent("лапаю её")).toBe(true);
    expect(hasSexualIntent("Он член городского совета, у него болит грудь")).toBe(false);
    expect(hasSexualIntent("от страха не могу говорить, купил хлеба и небо видно")).toBe(false);
  });
  it("нарушение только когда рядом ребёнок или герой несовершеннолетний", () => {
    expect(isChildSafetyViolation(withKid, busy, "лапаю её")).toBe(true);
    expect(isChildSafetyViolation(world, busy, "лапаю её")).toBe(false);
    expect(isChildSafetyViolation(withKid, busy, "даю девочке яблоко")).toBe(false);
    const childHero: GameState = { ...busy, playerProfile: { ...busy.playerProfile!, age: 12 }, ...(busy.development ? { development: { ...busy.development, birthMinute: busy.minute - 12 * 365 * 1440 } } : {}) };
    expect(isChildSafetyViolation(world, childHero, "секс")).toBe(true);
  });
  it("три предупреждения, затем бан", () => {
    const store = localSafetyStore(new Mem());
    for (let i = 1; i <= SAFETY_WARNINGS_BEFORE_BAN; i++) {
      const r = registerViolation(store);
      expect(r.record.banned).toBe(false);
      expect(r.message).toContain(`Предупреждение ${i} из 3`);
    }
    const last = registerViolation(store);
    expect(last.record.banned).toBe(true);
    expect(store.load().banned).toBe(true);
  });
  it("нарушение уходит в серверный отчёт, когда он подключён", () => {
    const reports: string[] = [];
    const store = { ...localSafetyStore(new Mem()), report: (_r: unknown, reason: string) => { reports.push(reason); } };
    registerViolation(store);
    expect(reports).toEqual(["child-safety"]);
  });
});
