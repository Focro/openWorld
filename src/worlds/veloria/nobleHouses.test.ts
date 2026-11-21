import { describe, expect, it } from "vitest";
import { NOBLE_HOUSES, housesInState, validateGenealogies } from "./nobleHouses";
import { CONTINENTS, resolveStart } from "./continents";

describe("Veloria canon registry",()=>{
  it("contains five major houses in each of six states",()=>{
    expect(NOBLE_HOUSES).toHaveLength(30);
    for(const state of ["estran","sahrad","tharvek","varent","elyndor","kharum"]) expect(housesInState(state)).toHaveLength(5);
  });
  it("has internally referenced family trees",()=>expect(validateGenealogies()).toEqual([]));
  it("keeps distant continents unavailable to ordinary starts",()=>{
    expect(CONTINENTS).toHaveLength(3);
    expect(resolveStart({continentId:"nar-il"},{originId:"wanderer"}).ok).toBe(false);
  });
  it("forces the ordinary start to Roven even when origin is elsewhere",()=>{
    expect(resolveStart({continentId:"ardan",stateId:"sahrad",settlementId:"qadira"},{originId:"wanderer"}).ok).toBe(false);
    const result = resolveStart({continentId:"ardan",stateId:"sahrad"},{originId:"wanderer"});
    expect(result.ok).toBe(true);
    if(result.ok) expect(result.choice.settlementId).toBe("roven");
  });
  it("rejects a region that does not belong to the selected origin state",()=>{
    expect(resolveStart({continentId:"ardan",stateId:"sahrad",regionId:"estran-heart"},{originId:"wanderer"}).ok).toBe(false);
  });
  it("rejects a noble origin placed in another state without an explanation",()=>{
    expect(resolveStart({continentId:"ardan",stateId:"kharum"},{originId:"minor-heir",houseId:"valecourt",citizenshipStateId:"estran"}).ok).toBe(false);
  });
});
