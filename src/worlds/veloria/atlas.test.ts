import {describe,it,expect} from "vitest";
import {COUNTRIES,COUNTRY_SHAPES,MAP_NODES,REGIONS,ROUTES} from "./atlas";
import {FAITHS} from "./faiths";
import {NOBLE_HOUSES,validHouseParents} from "./lineages";
import {LIFE_PROFILES} from "./lifeBurden";
import {HIDDEN_ACTORS,canRevealActor,actorMayAppear} from "./hiddenActors";
describe("Veloria expansion",()=>{
it("has six countries and a mapped capital per country",()=>{expect(COUNTRIES).toHaveLength(6);for(const c of COUNTRIES)expect(MAP_NODES.some(n=>n.id===c.capital&&n.countryId===c.id)).toBe(true)});
it("has no route endpoints missing from the atlas",()=>{const ids=new Set(MAP_NODES.map(n=>n.id));for(const r of ROUTES){expect(ids.has(r.from)).toBe(true);expect(ids.has(r.to)).toBe(true);expect(r.days).toBeGreaterThan(0)}});
it("maps every primary faith",()=>{const ids=new Set(FAITHS.map(f=>f.id));for(const c of COUNTRIES)expect(ids.has(c.primaryFaith)).toBe(true)});
it("has valid lineage parent references",()=>{for(const h of NOBLE_HOUSES)expect(validHouseParents(h)).toBe(true)});
it("differentiates social burdens",()=>{expect(LIFE_PROFILES.find(p=>p.id==="temple_orphan")!.burdens).toContain("hunger_risk");expect(LIFE_PROFILES.find(p=>p.id==="crown_heir")!.burdens).toContain("poisoning_risk")});
it("keeps secret actors sealed until clues are found",()=>{for(const a of HIDDEN_ACTORS){expect(a.knownToPlayerInitially).toBe(false);expect(canRevealActor(a,[])).toBe(false)}const a=HIDDEN_ACTORS[0];expect(canRevealActor(a,a.revealConditions)).toBe(true)});
it("does not spawn hidden actors at arbitrary untracked locations",()=>{const a=HIDDEN_ACTORS[0];expect(actorMayAppear(a,"azrakar",false,0.01)).toBe(false);expect(actorMayAppear(a,a.startingNodeId,true,0.5)).toBe(false)});
});

describe("complete atlas integrity",()=>{
  it("has unique settlement identifiers and valid map coordinates",()=>{
    const ids=MAP_NODES.map(n=>n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for(const node of MAP_NODES){
      expect(node.x).toBeGreaterThanOrEqual(0); expect(node.x).toBeLessThanOrEqual(100);
      expect(node.y).toBeGreaterThanOrEqual(0); expect(node.y).toBeLessThanOrEqual(100);
      expect(COUNTRIES.some(c=>c.id===node.countryId)).toBe(true);
      expect(REGIONS.some(r=>r.id===node.regionId&&r.countryId===node.countryId)).toBe(true);
    }
  });
  it("has one drawable country outline for every country",()=>{
    expect(COUNTRY_SHAPES.map(shape=>shape.countryId).sort()).toEqual(COUNTRIES.map(country=>country.id).sort());
    for(const shape of COUNTRY_SHAPES) for(const [x,y] of shape.points){expect(x).toBeGreaterThanOrEqual(0);expect(x).toBeLessThanOrEqual(100);expect(y).toBeGreaterThanOrEqual(0);expect(y).toBeLessThanOrEqual(100);}
  });
  it("connects every mapped settlement to the travel network",()=>{
    const ids=new Set(MAP_NODES.map(n=>n.id));
    const reached=new Set<string>(); const queue=[MAP_NODES[0]!.id];
    while(queue.length){const id=queue.shift()!;if(reached.has(id))continue;reached.add(id);
      for(const route of ROUTES){const next=route.from===id?route.to:route.to===id?route.from:null;if(next&&!reached.has(next))queue.push(next);}}
    expect(reached.size).toBe(ids.size);
    expect(MAP_NODES.length).toBeGreaterThanOrEqual(30);
  });
});
