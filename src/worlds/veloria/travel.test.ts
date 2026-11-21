import { describe, expect, it } from "vitest";
import { createInitialState } from "../../engine/world";
import { createVeloriaWorld } from "./world";
import { advanceVeloriaJourney, beginVeloriaJourney, findVeloriaRoute, isRouteSeasonallyClosed } from "./travel";

const WORLD = createVeloriaWorld();

describe("Veloria overland travel", () => {
  it("finds a route between Roven and Varentport", () => {
    const route = findVeloriaRoute("roven", "varentport");
    // Вниз по Лиру и через море Лиар: дни считаются из расстояния на карте.
    expect(route?.totalDays).toBeGreaterThan(1);
    expect(route?.segments[0]?.mode).toBe("sea");
    expect(route?.segments[0]?.from).toBe("roven");
  });
  it("requires the player to physically reach the Roven gate first", () => {
    const initial = createInitialState(WORLD);
    const result = beginVeloriaJourney(initial, "varentport");
    expect(result.ok).toBe(false);
    expect(result.state).toBe(initial);
  });
  it("does not allow a dead character to begin a journey", () => {
    const initial = { ...createInitialState(WORLD), lifeStatus: "dead" as const };
    const result = beginVeloriaJourney(initial, "varentport");
    expect(result.ok).toBe(false);
    expect(result.state).toBe(initial);
  });
  it("returns to Roven at the South Gate rather than the previous street", () => {
    const abroad = { ...createInitialState(WORLD), settlementId: "varentport", playerLocation: "atlas:varentport:gate" };
    const started = beginVeloriaJourney(abroad, "roven");
    expect(started.ok).toBe(true);
    let state = started.state;
    let result;
    for (let i = 0; i < 8; i++) { result = advanceVeloriaJourney(state); state = result.state; }
    expect(state.settlementId).toBe("roven");
    expect(state.playerLocation).toBe("south-gate");
    expect(WORLD.locations[state.playerLocation]).toBeTruthy();
  });
  it("advances by days and only arrives after the full route", () => {
    const initial = { ...createInitialState(WORLD), playerLocation: "south-gate" };
    const started = beginVeloriaJourney(initial, "varentport");
    expect(started.ok).toBe(true);
    expect(started.state.settlementId).toBe("roven");
    let state = started.state;
    const days = findVeloriaRoute("roven", "varentport")!.totalDays;
    let result = advanceVeloriaJourney(state);
    for (let i = 0; i < days - 2; i++) { result = advanceVeloriaJourney(result.state); expect(result.arrived).toBe(false); }
    result = advanceVeloriaJourney(result.state);
    expect(result.arrived).toBe(true);
    expect(result.state.settlementId).toBe("varentport");
    expect(result.state.playerLocation).toBe("atlas:varentport:gate");
    expect(WORLD.locations[result.state.playerLocation]).toBeTruthy();
    expect(result.state.journey).toBeUndefined();
  });
});

it("closes snowbound routes during winter and reopens them in spring",()=>{
  const winterMinute = 300 * 1440;
  expect(isRouteSeasonallyClosed({from:"koronholm",to:"northwatch",days:4,mode:"road",danger:"moderate",seasonalClosure:"сильные снегопады"}, winterMinute)).toBe(true);
  expect(isRouteSeasonallyClosed({from:"koronholm",to:"northwatch",days:4,mode:"road",danger:"moderate",seasonalClosure:"сильные снегопады"}, 0)).toBe(false);
  expect(findVeloriaRoute("roven", "northwatch", winterMinute)).toBeNull();
  expect(findVeloriaRoute("roven", "northwatch", 0)).not.toBeNull();
});

it("ages the character for every elapsed travel day, including partial route segments",()=>{
  const initial = {
    ...createInitialState(WORLD),
    playerLocation: "south-gate",
    playerProfile: {
      age: 20, originId: "commoner", statusId: "free", professionId: "laborer", familyState: "unknown",
      startScenarioId: "arrival", biography: "", attributes: {}, difficultyId: "balanced" as const,
      ageProgressMinutes: 0
    }
  };
  const started = beginVeloriaJourney(initial, "varentport");
  let state = started.state;
  const days = findVeloriaRoute("roven", "varentport")!.totalDays;
  for (let i = 0; i < days; i++) state = advanceVeloriaJourney(state).state;
  expect(state.playerProfile?.ageProgressMinutes).toBe(days * 1440);
});


it("requires the player to reach the local gate before leaving another settlement",()=>{
  const abroad = { ...createInitialState(WORLD), settlementId: "varentport", playerLocation: "atlas:varentport:square" };
  const result = beginVeloriaJourney(abroad, "roven");
  expect(result.ok).toBe(false);
  expect(result.state).toBe(abroad);
});

it("ребёнок при семье может только сбежать, сирота уходит сам, малыш никуда; без денег судно не возьмёт", () => {
  const base = { ...createInitialState(WORLD), playerLocation: "south-gate" };
  const kid = (age: number, agility = 14) => ({ ...base, playerProfile: { age, originId: "commoner", statusId: "free", professionId: "none", familyState: "together", startScenarioId: "ordinary", biography: "", attributes: { "Ловкость": agility, "Интеллект": 14 }, difficultyId: "balanced" as const } });
  expect(beginVeloriaJourney(kid(3), "koronholm").ok).toBe(false);
  // Сирота без опекунов: может уйти сам, дорога помечена как опасная для ребёнка.
  const orphan = beginVeloriaJourney(kid(9), "koronholm", { hasGuardians: false });
  expect(orphan.ok).toBe(true);
  expect(orphan.state.journey?.alone).toBe(true);
  expect(orphan.state.journey?.runawayFrom).toBeUndefined();
  // При семье: иногда ловят, иногда удаётся сбежать.
  let caught = 0, escaped = 0;
  for (let i = 0; i < 60; i++) {
    const r = beginVeloriaJourney({ ...kid(10, 20), minute: base.minute + i * 7 }, "koronholm", { hasGuardians: true });
    if (r.ok) { escaped++; expect(r.state.journey?.runawayFrom).toBe("roven"); } else { caught++; expect(r.message).toMatch(/взрослые замечают/); }
  }
  expect(caught).toBeGreaterThan(0);
  expect(escaped).toBeGreaterThan(0);
  // Деньги: судно стоит денег, пешком бесплатно.
  const poor = { ...base, money: 0 };
  const r2 = beginVeloriaJourney(poor, "varentport");
  expect(r2.ok).toBe(false);
  expect(r2.message).toMatch(/монет/);
  expect(beginVeloriaJourney(poor, "koronholm").ok).toBe(true);
  const paid = beginVeloriaJourney({ ...base, money: 100 }, "varentport");
  expect(paid.ok).toBe(true);
  expect(paid.state.money).toBeLessThan(100);
});

it("в пути одинокого ребёнка случаются беды, сбежавшего ищут", () => {
  const base = { ...createInitialState(WORLD), playerLocation: "south-gate", money: 10 };
  let found = 0, troubles = 0;
  for (let i = 0; i < 40; i++) {
    let s = { ...base, minute: base.minute + i * 1013, journey: { destinationId: "koronholm", route: findVeloriaRoute("roven", "koronholm")!.segments, segmentIndex: 0, daysRemaining: 5, elapsedDays: 0, alone: true, runawayFrom: "roven" } } as typeof base;
    for (let d = 0; d < 6 && s.journey; d++) { const r = advanceVeloriaJourney(s); if (/находят/.test(r.message)) found++; if (/обирают|мёрзнете/.test(r.message)) troubles++; s = r.state; }
  }
  expect(found).toBeGreaterThan(0);
  expect(troubles).toBeGreaterThan(0);
});
