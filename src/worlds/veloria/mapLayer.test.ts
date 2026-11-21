import { describe, expect, it } from "vitest";
import { knownSettlementIds, mapHitAt, REGION_ANCHORS } from "./mapLayer";
import { MAP_NODES, REGIONS } from "./atlas";

describe("интерактивная карта", () => {
  it("тап по поселению показывает его название и державу", () => {
    const roven = MAP_NODES.find(n => n.id === "roven")!;
    const hit = mapHitAt(roven.x + 0.5, roven.y)!;
    expect(hit.kind).toBe("settlement");
    expect(hit.name).toBe("Ровен");
    expect(hit.detail).toMatch(/Эстран/);
  });
  it("тап по горам показывает край", () => {
    const range = REGION_ANCHORS.find(r => r.id === "tharvek-range")!;
    const node = MAP_NODES.filter(n => n.regionId === "tharvek-range").sort((a, b) => Math.hypot(a.x - range.x, a.y - range.y) - Math.hypot(b.x - range.x, b.y - range.y))[0]!;
    // Чуть в стороне от поселения, но в своём крае.
    const x = range.x + (range.x === node.x ? 5 : 0), y = range.y;
    const hit = mapHitAt(x, y, 0.1)!;
    expect(["region", "country"]).toContain(hit.kind);
    if (hit.kind === "region") expect(hit.name).toBe("Высокий хребет");
  });
  it("у каждого края с поселениями есть подпись", () => {
    for (const r of REGIONS) if (MAP_NODES.some(n => n.regionId === r.id)) expect(REGION_ANCHORS.some(a => a.id === r.id)).toBe(true);
  });
  it("в открытом море ничего не находит", () => {
    expect(mapHitAt(99, 99, 1, 1)).toBeNull();
  });
  it("показывает только известные герою места", () => {
    const known = knownSettlementIds("roven", "estran", ["varentport"]);
    expect(known.has("roven")).toBe(true);
    expect(known.has("varentport")).toBe(true);
    expect(known.has("koronholm")).toBe(true);
    const unknown = MAP_NODES.find(n => !known.has(n.id))!;
    expect(mapHitAt(unknown.x, unknown.y, 0.5, 0.1, known)?.id).not.toBe(unknown.id);
  });
  it("море Лиар и река Лир отвечают на нажатие", () => {
    expect(mapHitAt(58, 55, 0.1)?.name).toBe("Море Лиар");
    expect(mapHitAt(28, 41.3, 0.1)?.name).toBe("Река Лир");
  });
});
