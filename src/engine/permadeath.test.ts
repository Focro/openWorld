import { describe, expect, it } from "vitest";
import { buryIfDead, lifeIdOf, loadBlockedByDeath, mergeGraveyards, newLifeId } from "./permadeath";
import type { GameState } from "./types";

const hero = (over: Partial<GameState> = {}) => ({ playerName: "Лиан", minute: 1000, lifeId: "life-1", lifeStatus: "alive", ...over }) as unknown as GameState;

describe("окончательная смерть", () => {
  it("умерший герой не возвращается из старого сохранения", () => {
    const dead = hero({ lifeStatus: "dead", deathRecord: { minute: 900, cause: "болезнь", locationId: "roven", witnessedBy: [] } });
    const graves = buryIfDead("veloria", dead, []);
    expect(graves).toHaveLength(1);
    expect(graves[0]).toMatchObject({ lifeId: "life-1", name: "Лиан", diedAtMinute: 900 });
    expect(buryIfDead("veloria", dead, graves)).toBe(graves);
    expect(loadBlockedByDeath(hero({ minute: 500 }), graves)?.name).toBe("Лиан");
    // Сохранение самой смерти открыть можно, другого героя тоже.
    expect(loadBlockedByDeath(dead, graves)).toBeNull();
    expect(loadBlockedByDeath(hero({ lifeId: "life-2" }), graves)).toBeNull();
  });
  it("живой герой не попадает в список", () => {
    expect(buryIfDead("veloria", hero(), [])).toEqual([]);
  });
  it("у старых сохранений номер жизни берётся из рецепта", () => {
    const old = hero({ lifeId: undefined, campaign: { worldId: "veloria", recipe: { draft: { familySeed: "abc", name: "Лиан", age: 5 } } } });
    expect(lifeIdOf(old)).toBe("legacy:abc:Лиан:5");
    expect(newLifeId()).not.toBe(newLifeId());
  });
  it("списки с разных устройств сливаются без повторов", () => {
    const a = [{ lifeId: "x", worldId: "veloria", name: "А", diedAtMinute: 1, recordedAt: "" }];
    const b = [{ lifeId: "x", worldId: "veloria", name: "А", diedAtMinute: 1, recordedAt: "" }, { lifeId: "y", worldId: "veloria", name: "Б", diedAtMinute: 2, recordedAt: "" }];
    expect(mergeGraveyards(a, b).map(r => r.lifeId)).toEqual(["x", "y"]);
  });
});
