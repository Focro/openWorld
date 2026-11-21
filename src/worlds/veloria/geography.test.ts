import { describe, expect, it } from "vitest";
import { COUNTRY_SHAPES, MAP_NODES, MAP_WATERS, REGIONS, ROUTES, KM_PER_DAY, routeKm } from "./atlas";
import { findVeloriaRoute, travelOptions } from "./travel";

const inside = (x: number, y: number, pts: Array<[number, number]>) => {
  let r = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i]!, [xj, yj] = pts[j]!; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) r = !r; }
  return r;
};
const node = (id: string) => MAP_NODES.find(n => n.id === id)!;

describe("география по Библии мира", () => {
  it("каждое поселение лежит в своей державе и не в море", () => {
    for (const n of MAP_NODES) {
      expect(inside(n.x, n.y, COUNTRY_SHAPES.find(s => s.countryId === n.countryId)!.points), n.id).toBe(true);
      for (const w of MAP_WATERS.filter(w => w.kind === "sea")) expect(inside(n.x, n.y, w.points), `${n.id} в море`).toBe(false);
    }
  });
  it("стороны света как в Библии: Сахрад юг, Тарвек восток, Варент северо-восток, Элиндор запад, Кхарум юго-восток", () => {
    const r = node("roven"), cap = (c: string) => MAP_NODES.find(n => n.countryId === c && n.kind === "capital")!;
    expect(cap("sahrad").y).toBeGreaterThan(r.y + 20);
    expect(cap("tharvek").x).toBeGreaterThan(r.x + 30);
    expect(cap("varent").x).toBeGreaterThan(r.x); expect(cap("varent").y).toBeLessThan(r.y);
    expect(cap("elyndor").x).toBeLessThan(r.x - 20);
    expect(cap("kharum").x).toBeGreaterThan(r.x + 30); expect(cap("kharum").y).toBeGreaterThan(r.y + 30);
  });
  it("дни пути сходятся с расстоянием на карте", () => {
    for (const route of ROUTES) {
      const km = routeKm(node(route.from), node(route.to));
      expect(route.days).toBe(Math.max(1, Math.ceil(km / KM_PER_DAY[route.mode])));
    }
    // Чем дальше на карте, тем дольше путь по суше.
    expect(findVeloriaRoute("roven", "koronholm")!.totalDays).toBeLessThan(findVeloriaRoute("roven", "northwatch")!.totalDays);
    expect(findVeloriaRoute("roven", "har-kadar")!.totalDays).toBeGreaterThan(findVeloriaRoute("roven", "qadira")!.totalDays);
  });
  it("каноном помечены места из Библии, аудита канона и реестра домов, остальное проектное", () => {
    const canon = MAP_NODES.filter(n => n.canon).map(n => n.id).sort();
    // Библия: 9 городов. Аудит канона: Меровар, Нортвотч, Железный Перевал. Реестр домов: Сафра, Синяя Гавань, Ивовый Предел, Намар.
    expect(canon).toEqual(["azrakar", "bluehaven", "dravorn", "har-kadar", "ironpass", "koronholm", "lethariel", "merovar", "miraj", "namar", "northwatch", "qadira", "roven", "safra", "varentport", "willowmere"]);
    expect(REGIONS.filter(r => r.canon).map(r => r.name).sort()).toEqual(["Медное побережье", "Северные холмы", "Южная долина"]);
    expect(ROUTES.find(r => r.name === "Западный тракт")).toBeDefined();
  });
  it("где можно обойти по суше, есть и сухопутный путь", () => {
    for (const to of ["varentport", "miraj"]) {
      const opts = travelOptions("roven", to);
      expect(opts.length, to).toBe(2);
      expect(opts[0]!.overland).toBe(false);
      expect(opts[1]!.overland).toBe(true);
      expect(opts[1]!.plan.segments.some(s => s.mode === "sea")).toBe(false);
      expect(opts[1]!.plan.totalDays).toBeGreaterThan(opts[0]!.plan.totalDays);
    }
  });
});
