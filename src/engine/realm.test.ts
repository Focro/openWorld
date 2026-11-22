import { describe, expect, it } from "vitest";
import { advanceRealm, createRealm, realmFactsReached, stepRealmDay, type RealmLedger } from "./realm";
import { applyAction } from "./rules";
import { buildSceneContext } from "./speech";
import { npcsAt } from "./world";
import { MINUTES_PER_DAY } from "./time";
import { VELORIA_REALM } from "../worlds/veloria/realm";
import { startVeloriaCampaign } from "../worlds/veloria/campaign";
import type { GameState } from "./types";

const ATTRS = { "Сила": 15, "Выносливость": 15, "Ловкость": 14, "Интеллект": 14, "Восприятие": 14, "Харизма": 14, "Воля": 14 };
const def = VELORIA_REALM;
const fresh = () => createRealm(def, 100, 42);
const facts = (ledger: RealmLedger, kind: string) => ledger.facts.filter(f => f.kind === kind);

describe("вторая книга: державы делают ходы, которые стоят ресурсов", () => {
  it("день не проживается дважды, один и тот же ход при том же зерне", () => {
    const a = advanceRealm(def, fresh(), 130 * MINUTES_PER_DAY);
    const b = advanceRealm(def, fresh(), 130 * MINUTES_PER_DAY);
    expect(a).toEqual(b);
    expect(a.day).toBe(130);
    expect(stepRealmDay(def, a, 130)).toBe(a);
    expect(advanceRealm(def, a, 130 * MINUTES_PER_DAY)).toBe(a);
  });

  it("стычки без зерна нет, с запасами есть", () => {
    const setup = (grain: number) => {
      const l = fresh();
      l.grudges = [...l.grudges.filter(g => !(g.from === "estran" && g.against === "tharvek")), { from: "estran", against: "tharvek", weight: 80 }];
      Object.assign(l.powers.estran!, { grain, treasury: 400, troops: 20, goal: "pressure", goalUntilDay: 10_000 });
      return stepRealmDay(def, l, 101);
    };
    expect(facts(setup(50), "skirmish")).toHaveLength(0);
    const fought = setup(400);
    expect(facts(fought, "skirmish")).toHaveLength(1);
    expect(fought.powers.estran!.grain).toBeLessThan(400);
    expect(fought.powers.tharvek!.troops).toBeLessThan(22);
  });

  it("реформа без стабильности срывается", () => {
    const reforms = [];
    for (let seed = 1; seed <= 60; seed++) {
      const l = createRealm(def, 100, seed);
      Object.assign(l.powers.sahrad!, { stability: 20, treasury: 5000, duty: 0, goal: "reform", goalUntilDay: 100_000 });
      const next = stepRealmDay(def, l, 101);
      reforms.push(...facts(next, "reform").filter(f => f.powers.includes("sahrad")));
      if (facts(next, "reform").length) expect(next.powers.sahrad!.stability).toBeLessThan(20.1);
    }
    expect(reforms.length).toBeGreaterThan(0);
    for (const f of reforms) expect(f.text).toMatch(/срывается/);
  });

  it("союз только при взаимной выгоде: обида перекрывает торговлю", () => {
    const l = fresh();
    l.grudges.push({ from: "varent", against: "estran", weight: 90 });
    const after = advanceRealm(def, l, 160 * MINUTES_PER_DAY);
    expect(after.treaties.some(t => t.kind === "trade" && t.parties.includes("varent") && t.parties.includes("estran"))).toBe(false);
  });

  it("за десять лет книга ограничена и без отрицательных запасов", () => {
    const l = advanceRealm(def, fresh(), (100 + 3650) * MINUTES_PER_DAY);
    expect(l.facts.length).toBeLessThanOrEqual(200);
    for (const p of Object.values(l.powers)) {
      expect(p.grain).toBeGreaterThanOrEqual(0);
      expect(p.treasury).toBeGreaterThanOrEqual(0);
      expect(p.stability).toBeGreaterThanOrEqual(0);
    }
    expect(JSON.stringify(l).length).toBeLessThan(60_000);
  });
});

describe("проверка тайны: тайный договор Варента и Кхарума не доходит до героя", () => {
  it("за неделю в Ровене договор заключён, но его нет ни в дневнике, ни в памяти соседей, ни в запросе модели", () => {
    const r = startVeloriaCampaign({ kind: "veloria-character", difficultyId: "balanced", draft: { name: "Ирина", age: 24, originId: "merchant-child", statusId: "guild-free", professionId: "merchant", familyState: "together", startScenarioId: "ordinary", biography: "", attributes: { ...ATTRS } } });
    if (!r.ok) throw new Error(r.errors.join(" "));
    const world = r.world;
    const realm = createRealm(def, Math.floor(r.state.minute / MINUTES_PER_DAY), 7);
    // Обе обижены на Сахрад: есть общий повод сговориться.
    realm.grudges.push({ from: "varent", against: "sahrad", weight: 40 }, { from: "kharum", against: "sahrad", weight: 40 });
    for (const id of ["varent", "kharum"]) Object.assign(realm.powers[id]!, { goal: "pressure", goalUntilDay: 1e9 });
    let state: GameState = { ...r.state, realm };
    const live = applyAction(world, state, { type: "live", days: 7 });
    expect(live.ok).toBe(true);
    state = live.state;

    const pact = state.realm!.treaties.find(t => t.kind === "secret-pact" && t.parties.includes("varent") && t.parties.includes("kharum"));
    expect(pact).toBeTruthy();
    const secret = state.realm!.facts.find(f => f.kind === "secret-pact")!;
    expect(secret.scope).toBe("secret");
    expect(secret.reached).toEqual([]);
    expect(realmFactsReached(state.realm, "roven")).toEqual([]);

    const leak = /сговарива|тайн[оы]|Кхарум|Варент/;
    expect(state.playerMemory.some(m => leak.test(m.text))).toBe(false);
    expect(Object.values(state.npcMemory).flat().some(m => /сговарива/.test(m.text))).toBe(false);
    expect(state.chronicle.some(e => /сговарива/.test(e.text))).toBe(false);
    expect(live.message).not.toMatch(leak);

    // Сцена с людьми рядом: в JSON запроса нет ни договора, ни книги.
    for (let hour = 0; hour < 24; hour++) {
      const minute = state.minute + hour * 60;
      const here = Object.keys(world.locations).find(id => npcsAt(world, minute, id, state.npcDeaths).length);
      if (here) { state = { ...state, minute, playerLocation: here }; break; }
    }
    const scene = JSON.stringify(buildSceneContext(world, state, "Какие новости из Варента?"));
    expect(scene).not.toMatch(/сговарива/);
    expect(scene).not.toMatch(/treasury|stability|secret-pact/);
  });
});
