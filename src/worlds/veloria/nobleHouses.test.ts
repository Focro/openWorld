import { describe, expect, it } from "vitest";
import { CANON_HOUSES, NOBLE_HOUSES, heirCandidates, housesInState, validateGenealogies } from "./nobleHouses";
import { CONTINENTS, resolveStart } from "./continents";

describe("Veloria canon registry",()=>{
  it("contains five canon houses and three proposed houses in each of six states",()=>{
    expect(CANON_HOUSES()).toHaveLength(30);
    expect(NOBLE_HOUSES.filter(h => h.canonStatus === "proposal")).toHaveLength(18);
    for(const state of ["estran","sahrad","tharvek","varent","elyndor","kharum"]) {
      expect(housesInState(state).filter(h => h.canonStatus !== "proposal")).toHaveLength(5);
      expect(housesInState(state)).toHaveLength(8);
    }
  });
  it("keeps house and member ids unique across canon and proposals",()=>{
    expect(new Set(NOBLE_HOUSES.map(h=>h.id)).size).toBe(NOBLE_HOUSES.length);
    const ids = NOBLE_HOUSES.flatMap(h=>h.members.map(x=>x.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("derives heirs from the rule and the actual family",()=>{
    expect(heirCandidates("p-fenwick")).toMatchObject({ decided: true, candidates: [{ id: "fen-rozamund" }] });
    expect(heirCandidates("p-ashford").candidates[0]?.id).toBe("ash-garet");
    expect(heirCandidates("p-crow").candidates.map(c=>c.id)).not.toContain("crow-bran");
    const elected = heirCandidates("p-kremen");
    expect(elected.decided).toBe(false);
    expect(elected.candidates.map(c=>c.id)).toEqual(expect.arrayContaining(["kre-velko","kre-zlata","kre-goyko"]));
    expect(heirCandidates("valecourt").candidates).toEqual([]);
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
