/**
 * Родные героя для шага «Внешность» (0.19.0).
 *
 * Правило автора: внешность героя собирается только из черт родных: мама, папа,
 * две бабушки и два деда. Ничего со стороны. Бабушки и деды есть всегда, даже если
 * они уже умерли (тогда их нет в доме, но черты от них остаются).
 */
import type { AppearanceProfile, EyeColor, FacialFeatureSet, HairColor, HairTexture, SkinTone } from "./heritage";
import type { BodyBuild, HeightTendency } from "../../engine/development";
import { POPULATIONS, regionalName, sampleNativeAppearance, seedHash, type StateId } from "./populations";

export type NoseShape = "small" | "straight" | "aquiline" | "snub";
export type LipsShape = "thin" | "medium" | "full";
export type BrowShape = "light" | "thick" | "thin" | "joined";
export type KinMark = "freckles" | "mole" | "dimples" | "left-handed";

export const NOSE_LABEL: Record<NoseShape, string> = { small: "маленький", straight: "прямой", aquiline: "с горбинкой", snub: "курносый" };
export const LIPS_LABEL: Record<LipsShape, string> = { thin: "тонкие", medium: "обычные", full: "пухлые" };
export const BROWS_LABEL: Record<BrowShape, string> = { light: "светлые", thick: "густые", thin: "тонкие", joined: "сросшиеся" };
export const MARK_LABEL: Record<KinMark, string> = { freckles: "веснушки", mole: "родинка", dimples: "ямочки", "left-handed": "левша" };
export const HEIGHT_LABEL: Record<HeightTendency, string> = { short: "невысокий", average: "среднего роста", tall: "высокий" };
export const BUILD_LABEL: Record<BodyBuild, string> = { slender: "хрупкий", average: "обычного сложения", sturdy: "крепкий" };

const NOSES: NoseShape[] = ["small", "straight", "aquiline", "snub"];
const LIPS: LipsShape[] = ["thin", "medium", "full"];
const BROWS: BrowShape[] = ["light", "thick", "thin", "joined"];
const HEIGHTS: HeightTendency[] = ["short", "average", "tall"];
const BUILDS: BodyBuild[] = ["slender", "average", "sturdy"];
const MARKS: KinMark[] = ["freckles", "mole", "dimples", "left-handed"];

/** Черты, которые не входят в базовую наследуемую пятёрку (кожа, волосы, глаза, лицо). */
export interface KinFeatures { nose: NoseShape; lips: LipsShape; brows: BrowShape; height: HeightTendency; build: BodyBuild; marks: KinMark[] }

export type KinRelation = "мама" | "папа" | "бабушка" | "дед";
export interface KinMember {
  id: string;
  /** Имя без фамилии, как его зовут в семье. */
  given: string;
  relation: KinRelation;
  side: "mother" | "father";
  /** Жив ли и живёт ли рядом; умершие показываются как «покойный дед». */
  alive: boolean;
  look: AppearanceProfile;
  features: KinFeatures;
}

/** Выбор героя на шаге «Внешность». Всё необязательно: пустое берётся по умолчанию. */
export interface KinLookChoice {
  skinTone?: SkinTone; hairColor?: HairColor; hairTexture?: HairTexture; eyeColor?: EyeColor; facialFeatures?: FacialFeatureSet;
  nose?: NoseShape; lips?: LipsShape; brows?: BrowShape; heightTendency?: HeightTendency; bodyBuild?: BodyBuild; marks?: KinMark[];
}

const unit = (seed: string) => seedHash(seed) / 4294967296;
const pick = <T>(values: readonly T[], seed: string): T => values[seedHash(seed) % values.length]!;

/** Подпись родного: «мама Марта», «покойный дед Орвин». */
export function kinLabel(k: KinMember): string {
  const dead = !k.alive && (k.relation === "дед" || k.relation === "бабушка");
  const word = dead ? (k.relation === "дед" ? "покойный дед" : "покойная бабушка") : k.relation;
  return `${word} ${k.given}`;
}

export function randomFeatures(seed: string): KinFeatures {
  const marks = MARKS.filter(m => unit(`${seed}:mark:${m}`) < (m === "left-handed" ? 0.12 : m === "mole" ? 0.3 : 0.22));
  const brows: BrowShape = unit(`${seed}:joined`) < 0.08 ? "joined" : pick(BROWS.slice(0, 3), `${seed}:brows`);
  return { nose: pick(NOSES, `${seed}:nose`), lips: pick(LIPS, `${seed}:lips`), brows, height: pick(HEIGHTS, `${seed}:height`), build: pick(BUILDS, `${seed}:build`), marks };
}

/**
 * Родители одного из родителей героя. Черты родителя обязательно есть хотя бы у одного
 * из его родителей: иначе ему было бы не от кого их взять.
 */
function parentsOf(child: { look: AppearanceProfile; features: KinFeatures }, state: StateId, seed: string): Array<{ look: AppearanceProfile; features: KinFeatures }> {
  const pair = [0, 1].map(i => {
    const sampled = sampleNativeAppearance(state, `${seed}:${i}`);
    const look: AppearanceProfile = {
      skinTone: unit(`${seed}:${i}:skin`) < 0.55 ? child.look.skinTone : sampled.skinTone,
      hairColor: unit(`${seed}:${i}:hair`) < 0.5 ? child.look.hairColor : sampled.hairColor,
      hairTexture: unit(`${seed}:${i}:tex`) < 0.55 ? child.look.hairTexture : sampled.hairTexture,
      eyeColor: unit(`${seed}:${i}:eyes`) < 0.5 ? child.look.eyeColor : sampled.eyeColor,
      facialFeatures: unit(`${seed}:${i}:face`) < 0.5 ? child.look.facialFeatures : sampled.facialFeatures
    };
    const r = randomFeatures(`${seed}:${i}:features`);
    const features: KinFeatures = {
      nose: unit(`${seed}:${i}:nose`) < 0.5 ? child.features.nose : r.nose,
      lips: unit(`${seed}:${i}:lips`) < 0.5 ? child.features.lips : r.lips,
      brows: unit(`${seed}:${i}:brows`) < 0.5 ? child.features.brows : r.brows,
      height: unit(`${seed}:${i}:height`) < 0.5 ? child.features.height : r.height,
      build: unit(`${seed}:${i}:build`) < 0.5 ? child.features.build : r.build,
      marks: r.marks
    };
    return { look, features };
  });
  // Каждая черта родителя есть хотя бы у одного из его родителей.
  const giver = (key: string) => pair[seedHash(`${seed}:giver:${key}`) % 2]!;
  for (const key of ["skinTone", "hairColor", "hairTexture", "eyeColor", "facialFeatures"] as const) {
    if (!pair.some(p => p.look[key] === child.look[key])) (giver(key).look as unknown as Record<string, unknown>)[key] = child.look[key];
  }
  for (const key of ["nose", "lips", "brows", "height", "build"] as const) {
    if (!pair.some(p => p.features[key] === child.features[key])) (giver(key).features as unknown as Record<string, unknown>)[key] = child.features[key];
  }
  for (const mark of child.features.marks) if (!pair.some(p => p.features.marks.includes(mark))) giver(`mark:${mark}`).features.marks.push(mark);
  return pair;
}

export interface KinParentInput { id: string; given: string; sex: "male" | "female"; look: AppearanceProfile; alive: boolean; state: StateId }
export interface KinElderInput { id: string; given: string; sex: "male" | "female"; side: "mother" | "father"; look: AppearanceProfile }

/**
 * Собирает родных: родители и по двое их родителей. Бабушки и деды, которые живут в доме,
 * берутся как есть (их имя и внешность), остальные считаются покойными.
 */
export function buildKin(parents: KinParentInput[], elders: KinElderInput[], seed: string): KinMember[] {
  const kin: KinMember[] = [];
  for (const p of parents) {
    const side = p.sex === "female" ? "mother" as const : "father" as const;
    const features = randomFeatures(`${seed}:${p.id}:features`);
    kin.push({ id: p.id, given: p.given, relation: side === "mother" ? "мама" : "папа", side, alive: p.alive, look: p.look, features });
    const living = elders.filter(e => e.side === side);
    const generated = parentsOf({ look: p.look, features }, p.state, `${seed}:${p.id}:elders`);
    (["female", "male"] as const).forEach((sex, i) => {
      const present = living.find(e => e.sex === sex);
      const g = generated[i]!;
      const look = present ? present.look : g.look;
      const given = present ? present.given : regionalName(p.state, sex, `${seed}:${p.id}:elder-name:${sex}`).given;
      kin.push({ id: present?.id ?? `${p.id}-${sex === "female" ? "grandmother" : "grandfather"}`, given, relation: sex === "female" ? "бабушка" : "дед", side, alive: Boolean(present), look, features: g.features });
    });
  }
  return kin;
}

/** Все варианты черт у родных и от кого каждый вариант. */
export interface KinOptions<T> { value: T; from: KinMember[] }
function collect<T>(kin: KinMember[], get: (k: KinMember) => T): KinOptions<T>[] {
  const out: KinOptions<T>[] = [];
  for (const k of kin) {
    const v = get(k);
    const found = out.find(o => o.value === v);
    if (found) found.from.push(k); else out.push({ value: v, from: [k] });
  }
  return out;
}
export function kinOptions(kin: KinMember[]) {
  const marks: KinOptions<KinMark>[] = [];
  for (const k of kin) for (const m of k.features.marks) { const f = marks.find(o => o.value === m); if (f) f.from.push(k); else marks.push({ value: m, from: [k] }); }
  return {
    skinTone: collect(kin, k => k.look.skinTone).sort((a, b) => a.value - b.value),
    hairColor: collect(kin, k => k.look.hairColor),
    hairTexture: collect(kin, k => k.look.hairTexture),
    eyeColor: collect(kin, k => k.look.eyeColor),
    facialFeatures: collect(kin, k => k.look.facialFeatures),
    nose: collect(kin, k => k.features.nose),
    lips: collect(kin, k => k.features.lips),
    brows: collect(kin, k => k.features.brows),
    heightTendency: collect(kin, k => k.features.height),
    bodyBuild: collect(kin, k => k.features.build),
    marks
  };
}

/** Внешность по линии: 0 полностью мамина, 100 полностью папина. Черты берутся у родных этой линии. */
export function lookFromLine(kin: KinMember[], line: number, seed: string): Required<Omit<KinLookChoice, "marks">> & { marks: KinMark[] } {
  const mom = kin.filter(k => k.side === "mother"), dad = kin.filter(k => k.side === "father");
  const keys = ["skinTone", "hairColor", "hairTexture", "eyeColor", "facialFeatures", "nose", "lips", "brows", "heightTendency", "bodyBuild"] as const;
  const out: Record<string, unknown> = {};
  keys.forEach(key => {
    const fromDad = dad.length && (!mom.length || unit(`${seed}:line:${key}`) * 100 < line);
    const group = fromDad ? dad : mom;
    // Чаще от самого родителя, иногда от бабушки или деда этой линии.
    const who = unit(`${seed}:who:${key}`) < 0.7 ? group[0]! : group[1 + (seedHash(`${seed}:who2:${key}`) % Math.max(1, group.length - 1))] ?? group[0]!;
    out[key] = key === "heightTendency" ? who.features.height : key === "bodyBuild" ? who.features.build
      : key in who.features ? (who.features as unknown as Record<string, unknown>)[key] : (who.look as unknown as Record<string, unknown>)[key];
  });
  const marks = [...new Set((line >= 50 ? dad : mom).slice(0, 1).flatMap(k => k.features.marks))];
  return { ...(out as Required<Omit<KinLookChoice, "marks">>), marks };
}

/** Проверка: каждая выбранная черта есть у кого-то из родных. Пустой список родных: проверять нечего. */
export function validateKinChoice(kin: KinMember[], choice: KinLookChoice): string[] {
  if (!kin.length) return [];
  const o = kinOptions(kin);
  const errors: string[] = [];
  const check = <T>(value: T | undefined, list: KinOptions<T>[], label: string) => { if (value !== undefined && !list.some(x => x.value === value)) errors.push(`${label}: такой черты нет ни у кого из родных.`); };
  check(choice.skinTone, o.skinTone, "Кожа"); check(choice.hairColor, o.hairColor, "Цвет волос"); check(choice.hairTexture, o.hairTexture, "Волосы");
  check(choice.eyeColor, o.eyeColor, "Глаза"); check(choice.facialFeatures, o.facialFeatures, "Лицо"); check(choice.nose, o.nose, "Нос");
  check(choice.lips, o.lips, "Губы"); check(choice.brows, o.brows, "Брови"); check(choice.heightTendency, o.heightTendency, "Рост"); check(choice.bodyBuild, o.bodyBuild, "Сложение");
  for (const m of choice.marks ?? []) if (!o.marks.some(x => x.value === m)) errors.push(`Примета «${MARK_LABEL[m]}» не встречается у родных.`);
  return errors;
}

/** Подкидыш: родные неизвестны, выбор из обычных черт его края. */
export function regionOptions(state: StateId) {
  const p = POPULATIONS[state];
  return {
    skinTone: p.skinTone.map(([v]) => v).sort((a, b) => a - b), hairColor: p.hairColor.map(([v]) => v), hairTexture: p.hairTexture.map(([v]) => v),
    eyeColor: p.eyeColor.map(([v]) => v), facialFeatures: p.facialFeatures.map(([v]) => v), nose: NOSES, lips: LIPS, brows: BROWS, heightTendency: HEIGHTS, bodyBuild: BUILDS, marks: MARKS
  };
}
