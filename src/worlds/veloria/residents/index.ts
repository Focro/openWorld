/**
 * Реестр жителей мест Ардана (0.19.0, предложение канона).
 * В каждом месте не меньше десяти продуманных жителей; см. types.ts.
 *
 * Кого видит ИИ: только тех жителей, кто сейчас рядом с героем (по расписанию), и тех,
 * кого герой уже встречал. В общий справочник знаний жители не попадают. Люди, которые
 * работают в закрытых местах (дворец, шахта, казарма), в это время недоступны: героя туда не пускают.
 */
import type { LocationDef, WorldData } from "../../../engine/types";
import type { ResidentDef } from "./types";
import { ROVEN_RESIDENTS } from "./roven";
import { expandSettlement, spotId, type SettlementResidents } from "./compact";
import { ESTRAN_RESIDENTS } from "./estran";
import { SAHRAD_RESIDENTS } from "./sahrad";
import { VARENT_RESIDENTS } from "./varent";
import { THARVEK_RESIDENTS } from "./tharvek";
import { ELYNDOR_RESIDENTS } from "./elyndor";
import { KHARUM_RESIDENTS } from "./kharum";

export type { ResidentDef, ResidentLink, ResidentLinkKind, ResidentPassport } from "./types";
export { VELORIA_MONTHS } from "./types";

export const SETTLEMENT_GROUPS: SettlementResidents[] = [
  ...ESTRAN_RESIDENTS, ...SAHRAD_RESIDENTS, ...VARENT_RESIDENTS, ...THARVEK_RESIDENTS, ...ELYNDOR_RESIDENTS, ...KHARUM_RESIDENTS
];

export const RESIDENTS_BY_SETTLEMENT: Record<string, ResidentDef[]> = {
  roven: ROVEN_RESIDENTS,
  ...Object.fromEntries(SETTLEMENT_GROUPS.map(group => [group.settlementId, expandSettlement(group)]))
};

export const ALL_RESIDENTS: ResidentDef[] = Object.values(RESIDENTS_BY_SETTLEMENT).flat();

/** Семейные связи взаимны: если записано «родитель», у ребёнка появляется «сын или дочь», и наоборот. */
const REVERSE = { spouse: "spouse", parent: "child", child: "parent", sibling: "sibling" } as const;
(function completeFamilyLinks() {
  const byId = new Map(ALL_RESIDENTS.map(r => [r.id, r]));
  for (const r of ALL_RESIDENTS) for (const link of [...r.resident.links]) {
    const reverse = REVERSE[link.kind as keyof typeof REVERSE];
    const other = reverse ? byId.get(link.to) : undefined;
    if (other && reverse && !other.resident.links.some(x => x.to === r.id && x.kind === reverse)) other.resident.links.push({ to: r.id, kind: reverse });
  }
})();
export const residentsOf = (settlementId: string): ResidentDef[] => RESIDENTS_BY_SETTLEMENT[settlementId] ?? [];
export const residentById = (id: string): ResidentDef | undefined => ALL_RESIDENTS.find(r => r.id === id);
export const isResident = (npc: unknown): npc is ResidentDef => typeof npc === "object" && npc !== null && "resident" in npc;

/**
 * Добавляет жителей в мир. Авторские жители заменяют шаблонных торговца, хозяина двора и
 * стражника с теми же id. Для мест с закрытой частью создаётся локация, куда героя не пускают.
 */
export function attachResidents(world: WorldData): WorldData {
  const npcs = { ...world.npcs };
  const locations = { ...world.locations };
  for (const group of SETTLEMENT_GROUPS) {
    if (!group.closed) continue;
    const squareId = spotId(group.settlementId, "square");
    const square = locations[squareId];
    if (!square) continue;
    const closedId = spotId(group.settlementId, "closed");
    const closed: LocationDef = {
      id: closedId, name: group.closed.name, description: group.closed.description, restricted: group.closed.restricted,
      exits: [{ to: squareId, distanceM: 300, terrain: "street" }]
    };
    locations[closedId] = closed;
    locations[squareId] = { ...square, exits: [...square.exits.filter(e => e.to !== closedId), { to: closedId, distanceM: 300, terrain: "street" }] };
  }
  for (const r of ALL_RESIDENTS) npcs[r.id] = structuredClone(r);
  return { ...world, locations, npcs };
}
