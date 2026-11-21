import { describe, expect, it } from "vitest";
import { COUNTRIES, MAP_NODES, REGIONS } from "./atlas";
import { NOBLE_HOUSES } from "./nobleHouses";
import { PLACE_LORE, placeStory } from "./placeLore";
import { mapHitAt } from "./mapLayer";

describe("описания мест на карте", () => {
  it("у каждого места, края и державы есть описание", () => {
    for (const id of [...MAP_NODES.map(n => n.id), ...REGIONS.map(r => r.id), ...COUNTRIES.map(c => c.id)]) {
      expect(placeStory(id)?.text, id).toBeTruthy();
    }
  });
  it("у места из канона есть канонический текст, у проектного места его нет", () => {
    for (const n of MAP_NODES) {
      if (n.canon) expect(PLACE_LORE[n.id]!.canon, n.id).toBeTruthy();
      else expect(PLACE_LORE[n.id]!.canon, n.id).toBeUndefined();
    }
  });
  it("дома берутся из реестра, длинного тире нет", () => {
    const ids = new Set(NOBLE_HOUSES.map(h => h.id));
    for (const [id, lore] of Object.entries(PLACE_LORE)) {
      for (const h of lore.houseIds ?? []) expect(ids.has(h), `${id}: ${h}`).toBe(true);
      expect(`${lore.canon ?? ""}${lore.proposal ?? ""}`, id).not.toMatch(/—/);
    }
    expect(placeStory("miraj")!.houses[0]).toMatch(/Дом Мирджан/);
  });
  it("тап по Миражу показывает его историю", () => {
    const m = MAP_NODES.find(n => n.id === "miraj")!;
    const hit = mapHitAt(m.x, m.y)!;
    expect(hit.story?.text).toMatch(/Скрытый базар/);
    expect(hit.story?.hasProposal).toBe(true);
  });
});
