/**
 * Краткая запись жителя для мест с шаблонной картой (площадь, рынок, постоялый двор, ворота
 * и закрытые места). Разворачивается в полный ResidentDef через resident().
 */
import type { NpcDef, PersonalityTraits } from "../../../engine/types";
import type { StateId } from "../populations";
import type { ResidentDef, ResidentLinkKind, ResidentPassport } from "./types";
import { resident } from "./build";

/** square, market, inn, gate: открытые места; closed: куда героя не пускают. */
export type Spot = "square" | "market" | "inn" | "gate" | "closed";
export const spotId = (settlementId: string, spot: Spot) => `atlas:${settlementId}:${spot}`;

/** Ключи, которые заменяют шаблонных NPC мест (лавка, двор, ворота). */
const TEMPLATE_KEYS = new Set(["merchant", "innkeeper", "guard"]);

export interface CompactResident {
  k: string; n: string; s: "m" | "f"; b: [number, number, number]; bp?: string; o?: StateId;
  job: string; hh: string; home: Spot; tags: NonNullable<NpcDef["roleTags"]>; f?: ResidentPassport["faith"];
  look: [number, string, string, string, string]; hs: string; fh?: string; wear: string; build: string;
  mood: string; tr: [number, number, number, number, number, number, number, number, number, number];
  val: string[]; past: string; cope: string[]; hab: Array<[string, string]>;
  goals: string[]; fears: string[]; sp: string; q: string[]; sec?: string;
  ln: Array<[string, ResidentLinkKind, string?]>;
  day: Array<[number, number, Spot, string]>;
}

export interface ClosedPlace { name: string; description: string; restricted: string }

export interface SettlementResidents { settlementId: string; countryId: StateId; closed?: ClosedPlace; people: CompactResident[] }

const traits = (t: CompactResident["tr"]): PersonalityTraits => ({
  warmth: t[0], sociability: t[1], assertiveness: t[2], emotionalReactivity: t[3], patience: t[4],
  openness: t[5], discipline: t[6], suspicion: t[7], empathy: t[8], pride: t[9]
});

export function expandSettlement(group: SettlementResidents): ResidentDef[] {
  const node = group.settlementId;
  const local = new Set(group.people.map(p => p.k));
  const id = (k: string) => TEMPLATE_KEYS.has(k) ? `${node}:${k}` : `${node}:${k}`;
  const linkTo = (to: string) => local.has(to) ? id(to) : to;
  return group.people.map(p => resident({
    id: id(p.k), name: p.n, settlementId: node, originStateId: p.o ?? group.countryId, sex: p.s === "m" ? "male" : "female",
    birth: { year: p.b[0], month: p.b[1], day: p.b[2] }, ...(p.bp ? { birthplaceId: p.bp } : {}),
    occupation: p.job, household: p.hh, homeId: spotId(node, p.home), roleTags: p.tags, ...(p.f ? { faith: p.f } : {}),
    look: { skinTone: p.look[0], naturalHairColor: p.look[1], hairTexture: p.look[2], eyeColor: p.look[3], facialFeatures: p.look[4] },
    hairstyle: p.hs, ...(p.fh ? { facialHair: p.fh } : {}), clothing: p.wear, build: p.build,
    temperament: p.mood, traits: traits(p.tr), values: p.val, formative: [p.past], coping: p.cope,
    habits: p.hab.map(([label, trigger], i) => ({ id: `${p.k}-habit-${i + 1}`, label, trigger, strength: 78 - i * 12 })),
    goals: p.goals, fears: p.fears, speech: p.sp, quirks: p.q, ...(p.sec ? { secret: p.sec } : {}),
    links: p.ln.map(([to, kind, note]) => ({ to: linkTo(to), kind, ...(note ? { note } : {}) })),
    schedule: p.day.map(([from, to, spot, activity]) => ({ from, to, locationId: spotId(node, spot), activity }))
  }));
}
