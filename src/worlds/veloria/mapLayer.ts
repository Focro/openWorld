/**
 * Интерактивная карта Ардана (0.18.0).
 *
 * Координаты всех мест в атласе заданы в долях 0..100 по ширине и высоте карты.
 * Когда появится нарисованная карта (картинка), она ложится подложкой под те же координаты:
 * достаточно указать путь к файлу в MAP_IMAGE и, если надо, поправить x и y мест в atlas.ts.
 * Тап по карте показывает ближайшее место: поселение, край (горы, леса, дельта) или державу.
 */
import { COUNTRIES, COUNTRY_SHAPES, MAP_NODES, REGIONS } from "./atlas";

/** Картинка карты в public/ (путь относительно сайта) или null, пока её нет. */
export const MAP_IMAGE: { src: string; width: number; height: number } | null = null;

export type MapHitKind = "settlement" | "region" | "country";
export interface MapHit { kind: MapHitKind; id: string; name: string; detail: string; x: number; y: number }

const KIND_WORD: Record<string, string> = { capital: "столица", city: "город", town: "городок", village: "деревня", fort: "крепость", port: "порт", oasis: "оазис" };

/** Где подписывать края: в середине их поселений. */
export const REGION_ANCHORS: Array<{ id: string; name: string; terrain: string; x: number; y: number }> = REGIONS.flatMap(region => {
  const nodes = MAP_NODES.filter(n => n.regionId === region.id);
  if (!nodes.length) return [];
  return [{ id: region.id, name: region.name, terrain: region.terrain, x: nodes.reduce((s, n) => s + n.x, 0) / nodes.length, y: nodes.reduce((s, n) => s + n.y, 0) / nodes.length }];
});

function insidePolygon(x: number, y: number, points: Array<[number, number]> | number[][]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i] as [number, number], [xj, yj] = points[j] as [number, number];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Что под пальцем: сначала поселение рядом (радиус в долях карты), потом край, потом держава. */
export function mapHitAt(x: number, y: number, settlementRadius = 4, regionRadius = 12, known?: Set<string>): MapHit | null {
  const dist = (a: { x: number; y: number }) => Math.hypot(a.x - x, a.y - y);
  const node = MAP_NODES.filter(n => !known || known.has(n.id)).sort((a, b) => dist(a) - dist(b))[0];
  if (node && dist(node) <= settlementRadius) {
    const country = COUNTRIES.find(c => c.id === node.countryId)?.name ?? node.countryId;
    return { kind: "settlement", id: node.id, name: node.name, detail: `${KIND_WORD[node.kind] ?? node.kind}, ${country}`, x: node.x, y: node.y };
  }
  const shape = COUNTRY_SHAPES.find(s => insidePolygon(x, y, s.points));
  const region = [...REGION_ANCHORS].filter(r => !shape || REGIONS.find(g => g.id === r.id)?.countryId === shape.countryId).sort((a, b) => dist(a) - dist(b))[0];
  if (region && dist(region) <= regionRadius) return { kind: "region", id: region.id, name: region.name, detail: region.terrain, x: region.x, y: region.y };
  if (shape) {
    const country = COUNTRIES.find(c => c.id === shape.countryId);
    return { kind: "country", id: shape.countryId, name: country?.name ?? shape.countryId, detail: country?.government ?? "", x, y };
  }
  return null;
}

/**
 * Какие места герой знает: родная держава целиком, столицы всех держав (о них слышал каждый),
 * где он сейчас и где уже побывал. Остальное на карте не показывается.
 */
export function knownSettlementIds(currentId: string | undefined, homeStateId: string | undefined, visited: readonly string[] = []): Set<string> {
  const known = new Set<string>(visited);
  if (currentId) known.add(currentId);
  for (const n of MAP_NODES) if (n.kind === "capital" || (homeStateId && n.countryId === homeStateId)) known.add(n.id);
  return known;
}
