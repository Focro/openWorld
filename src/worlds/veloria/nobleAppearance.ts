/**
 * Устойчивая внешность всех членов дворянских домов.
 *
 * Правила (0.14.0):
 *  - основатели и члены без известных в доме родителей получают облик своей страны (populations.ts);
 *  - ребёнок двух известных родителей получает признаки только от них (без «скачков»);
 *  - если известен один родитель, второй считается местным жителем страны дома;
 *  - канонические описания (Элиана, Гарен, второй принц и его мать) не перезаписываются.
 * Результат детерминирован: одна и та же родословная всегда даёт ту же внешность.
 */
import { NOBLE_HOUSES, type DynasticHouse } from "./nobleHouses";
import type { AppearanceProfile, SkinTone } from "./heritage";
import { isStateId, pickFrom, sampleNativeAppearance, seedHash, type StateId } from "./populations";

/** Каноническая внешность, которую нельзя вывести из родословной. */
export const CANON_APPEARANCE: Record<string, AppearanceProfile> = {
  "rey-elin": { skinTone: 2, hairColor: "light-blond", hairTexture: "wavy", eyeColor: "grey", facialFeatures: "angular" },
  "rey-consort": { skinTone: 2, hairColor: "light-blond", hairTexture: "wavy", eyeColor: "grey", facialFeatures: "angular" },
  "rey-second-prince": { skinTone: 3, hairColor: "light-blond", hairTexture: "straight", eyeColor: "dark-brown", facialFeatures: "east-asian" },
  "rey-second-prince-mother": { skinTone: 5, hairColor: "black", hairTexture: "straight", eyeColor: "dark-brown", facialFeatures: "east-asian" }
};

/** Ребёнок двух родителей: каждый признак берётся у одного из них, тон кожи — между их тонами. */
export function childOf(a: AppearanceProfile, b: AppearanceProfile, seed: string): AppearanceProfile {
  const low = Math.min(a.skinTone, b.skinTone), high = Math.max(a.skinTone, b.skinTone);
  const skinTone = (low + (seedHash(`${seed}:skin`) % (high - low + 1))) as SkinTone;
  const face = a.facialFeatures === b.facialFeatures ? a.facialFeatures : pickFrom([a.facialFeatures, b.facialFeatures, "mixed" as const], `${seed}:face`);
  return {
    skinTone,
    hairColor: pickFrom([a.hairColor, b.hairColor], `${seed}:hair`),
    hairTexture: pickFrom([a.hairTexture, b.hairTexture], `${seed}:texture`),
    eyeColor: pickFrom([a.eyeColor, b.eyeColor], `${seed}:eyes`),
    facialFeatures: face
  };
}

function houseAppearances(house: DynasticHouse, known: Map<string, AppearanceProfile>): void {
  const stateId: StateId = isStateId(house.stateId) ? house.stateId : "estran";
  const ordered = [...house.members].sort((x, y) => x.birthYear - y.birthYear);
  for (const member of ordered) {
    if (known.has(member.id)) continue;
    const canon = CANON_APPEARANCE[member.id];
    if (canon) { known.set(member.id, canon); continue; }
    const parents = member.parentIds.map(id => known.get(id)).filter((x): x is AppearanceProfile => Boolean(x));
    const seed = `noble:${member.id}`;
    if (parents.length >= 2) known.set(member.id, childOf(parents[0]!, parents[1]!, seed));
    else if (parents.length === 1) known.set(member.id, childOf(parents[0]!, sampleNativeAppearance(stateId, `${seed}:other-parent`), seed));
    else known.set(member.id, sampleNativeAppearance(member.originStateId && isStateId(member.originStateId) ? member.originStateId : stateId, seed));
  }
}

function build(): Map<string, AppearanceProfile> {
  const known = new Map<string, AppearanceProfile>();
  for (const [id, look] of Object.entries(CANON_APPEARANCE)) known.set(id, look);
  for (const house of NOBLE_HOUSES) houseAppearances(house, known);
  return known;
}

let cache: Map<string, AppearanceProfile> | null = null;
export function nobleAppearance(memberId: string): AppearanceProfile | undefined {
  cache ??= build();
  return cache.get(memberId);
}
