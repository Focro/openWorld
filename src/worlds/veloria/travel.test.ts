import { describe, expect, it } from "vitest";
import { createInitialState } from "../../engine/world";
import { createVeloriaWorld } from "./world";
import { advanceVeloriaJourney, beginVeloriaJourney, findVeloriaRoute, isRouteSeasonallyClosed } from "./travel";

const WORLD = createVeloriaWorld();

describe("Veloria overland travel", () => {
  it("finds a route between Roven and Varentport", () => {
    const route = findVeloriaRoute("roven", "varentport");
    expect(route?.totalDays).toBe(8);
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
    let result = advanceVeloriaJourney(state);
    for (let i = 0; i < 7; i++) result = advanceVeloriaJourney(result.state);
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
  for (let i = 0; i < 8; i++) state = advanceVeloriaJourney(state).state;
  expect(state.playerProfile?.ageProgressMinutes).toBe(8 * 1440);
});


it("requires the player to reach the local gate before leaving another settlement",()=>{
  const abroad = { ...createInitialState(WORLD), settlementId: "varentport", playerLocation: "atlas:varentport:square" };
  const result = beginVeloriaJourney(abroad, "roven");
  expect(result.ok).toBe(false);
  expect(result.state).toBe(abroad);
});
