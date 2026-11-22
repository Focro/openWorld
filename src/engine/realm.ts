/**
 * Вторая книга: скрытое состояние держав и фракций.
 *
 * Игрок её не видит, и модели она не отдаётся. Раз в игровой день каждая держава делает
 * один ход, который стоит ресурсов. Факты книги выходят наружу только через носителя
 * (обоз, корабль, гонец): поле reached пусто, пока носитель не дошёл до поселения.
 * Движок не знает конкретного мира: числа, державы и фракции приходят из RealmDefinition.
 */
import { MINUTES_PER_DAY } from "./time";

export type PowerGoal = "prosper" | "fortify" | "reform" | "pressure" | "hoard";
export type RealmActionKind = "recruit" | "disband" | "buy-grain" | "raise-duty" | "lower-duty" | "reform" | "treaty" | "secret-pact" | "skirmish" | "rest";
export type FactionAim = "throne" | "trade" | "war" | "peace";

export interface PowerDef {
  id: string;
  name: string;
  ruler: string;
  /** Доход казны и урожай зерна в день, расход зерна населением в день. */
  incomePerDay: number;
  harvestPerDay: number;
  grainUsePerDay: number;
  start: { treasury: number; grain: number; troops: number; stability: number; duty: number };
  neighbors: string[];
}
export interface FactionDef { id: string; powerId: string; name: string; strength: number; aim: FactionAim }
export interface RealmDefinition {
  powers: PowerDef[];
  factions: FactionDef[];
  /** Взаимная выгода торговли пары держав (ключ "a|b" в алфавитном порядке), 0..40. */
  tradeBenefit: Record<string, number>;
  /** Стартовые обиды: кто, на кого, сила. */
  grudges: Grudge[];
}

export interface PowerState {
  id: string;
  treasury: number;
  grain: number;
  troops: number;
  /** 0..100. */
  stability: number;
  /** Пошлина 0..0.3. */
  duty: number;
  ruler: string;
  goal: PowerGoal;
  goalUntilDay: number;
  /** День последнего хода каждого вида: у ходов есть перезарядка. */
  last: Partial<Record<RealmActionKind, number>>;
}
export interface Treaty { id: string; parties: [string, string]; kind: "trade" | "secret-pact"; sinceDay: number; against?: string }
export interface Grudge { from: string; against: string; weight: number }
export interface FactionState { id: string; powerId: string; strength: number; aim: FactionAim; plot?: { against: string; sinceDay: number } }
export interface RealmFact {
  id: string;
  day: number;
  kind: RealmActionKind | "plot" | "treaty-broken";
  text: string;
  powers: string[];
  /** public: о факте знают дворы всех держав; secret: только knownBy. */
  scope: "public" | "secret";
  knownBy: string[];
  /** Поселения, куда факт уже довёз носитель. Пусто: факт не для игрока. */
  reached: string[];
}
export interface RealmLedger {
  day: number;
  seed: number;
  powers: Record<string, PowerState>;
  factions: Record<string, FactionState>;
  treaties: Treaty[];
  grudges: Grudge[];
  facts: RealmFact[];
  nextFact: number;
}

export const REALM_FACTS_LIMIT = 200;
const COOLDOWN: Record<RealmActionKind, number> = { recruit: 7, disband: 7, "buy-grain": 10, "raise-duty": 30, "lower-duty": 30, reform: 120, treaty: 30, "secret-pact": 60, skirmish: 14, rest: 0 };
const GRUDGE_DECAY_PER_DAY = 0.05;
const TREASURY_UPKEEP = 0.0005;
const STABILITY_RECOVERY = 0.05;
export const SKIRMISH_NEEDS = { grain: 100, treasury: 50, troops: 5 };
export const REFORM_COST = 60;

export const dayOf = (minute: number) => Math.floor(minute / MINUTES_PER_DAY);
const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const round = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Детерминированный ГСЧ: один и тот же день с тем же зерном даёт тот же исход. */
function rng(seed: number, day: number, salt: string) {
  let h = (seed ^ Math.imul(day + 1, 0x9e3779b1)) >>> 0;
  for (let i = 0; i < salt.length; i++) h = Math.imul(h ^ salt.charCodeAt(i), 0x01000193) >>> 0;
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRealm(def: RealmDefinition, day: number, seed: number): RealmLedger {
  const powers: Record<string, PowerState> = {};
  for (const p of def.powers) powers[p.id] = { id: p.id, ...structuredClone(p.start), ruler: p.ruler, goal: "prosper", goalUntilDay: day, last: {} };
  const factions: Record<string, FactionState> = {};
  for (const f of def.factions) factions[f.id] = { id: f.id, powerId: f.powerId, strength: f.strength, aim: f.aim };
  return { day, seed: seed >>> 0, powers, factions, treaties: [], grudges: structuredClone(def.grudges), facts: [], nextFact: 1 };
}

export const grudgeOf = (ledger: RealmLedger, from: string, against: string) => ledger.grudges.find(g => g.from === from && g.against === against)?.weight ?? 0;
const hasTreaty = (ledger: RealmLedger, a: string, b: string, kind?: Treaty["kind"]) => ledger.treaties.some(t => t.parties.includes(a) && t.parties.includes(b) && (!kind || t.kind === kind));

function addGrudge(ledger: RealmLedger, from: string, against: string, weight: number) {
  const g = ledger.grudges.find(x => x.from === from && x.against === against);
  if (g) g.weight = round(clamp(g.weight + weight, 0, 100));
  else ledger.grudges.push({ from, against, weight: round(clamp(weight, 0, 100)) });
}

function record(ledger: RealmLedger, fact: Omit<RealmFact, "id" | "day" | "reached">) {
  ledger.facts.push({ id: `rf${ledger.nextFact++}`, day: ledger.day, reached: [], ...fact });
  if (ledger.facts.length > REALM_FACTS_LIMIT) ledger.facts.splice(0, ledger.facts.length - REALM_FACTS_LIMIT);
}

const nameOf = (def: RealmDefinition, id: string) => def.powers.find(p => p.id === id)?.name ?? id;

/** Выгода союза для a с b: торговля минус обида. Союз только если выгодно обеим. */
export const treatyValue = (def: RealmDefinition, ledger: RealmLedger, a: string, b: string) => (def.tradeBenefit[pairKey(a, b)] ?? 0) - grudgeOf(ledger, a, b);

function chooseGoal(def: RealmDefinition, ledger: RealmLedger, p: PowerState): PowerGoal {
  const pdef = def.powers.find(x => x.id === p.id)!;
  const worst = Math.max(0, ...pdef.neighbors.map(n => grudgeOf(ledger, p.id, n)));
  if (p.grain < pdef.grainUsePerDay * 30) return "hoard";
  if (p.stability < 35) return "reform";
  if (worst >= 40 && p.troops >= SKIRMISH_NEEDS.troops && p.grain >= SKIRMISH_NEEDS.grain * 2) return "pressure";
  if (p.troops < pdef.start.troops * 0.7) return "fortify";
  return "prosper";
}

interface Option { kind: RealmActionKind; score: number; target?: string; run: () => void }

function options(def: RealmDefinition, ledger: RealmLedger, p: PowerState, random: () => number): Option[] {
  const pdef = def.powers.find(x => x.id === p.id)!;
  const ready = (kind: RealmActionKind) => (p.last[kind] ?? -Infinity) + COOLDOWN[kind] <= ledger.day;
  const goalBonus = (kind: RealmActionKind) => ({ prosper: ["treaty", "lower-duty"], fortify: ["recruit"], reform: ["reform", "lower-duty"], pressure: ["skirmish", "secret-pact", "recruit"], hoard: ["buy-grain", "raise-duty"] } as Record<PowerGoal, RealmActionKind[]>)[p.goal].includes(kind) ? 5 : 0;
  const out: Option[] = [];
  const add = (kind: RealmActionKind, base: number, run: () => void, target?: string) => { if (ready(kind)) out.push({ kind, score: base + goalBonus(kind) + random() * 2, run, ...(target ? { target } : {}) }); };
  const name = nameOf(def, p.id);

  if (p.treasury >= 40 && p.troops < pdef.start.troops * 1.5) add("recruit", 1, () => { p.treasury -= 20; p.troops += 1; record(ledger, { kind: "recruit", text: `${name} набирает войско.`, powers: [p.id], scope: "public", knownBy: [] }); });
  if (p.treasury < 10 && p.troops > 2) add("disband", 7, () => { p.troops -= 1; record(ledger, { kind: "disband", text: `${name} распускает часть войска: нечем платить.`, powers: [p.id], scope: "public", knownBy: [] }); });
  if (p.treasury >= 15) add("buy-grain", p.grain < pdef.grainUsePerDay * 30 ? 8 : 0, () => { p.treasury -= 15; p.grain += 30; record(ledger, { kind: "buy-grain", text: `${name} закупает зерно.`, powers: [p.id], scope: "public", knownBy: [] }); });
  if (p.duty < 0.3) add("raise-duty", p.treasury < 20 ? 4 : 0, () => {
    p.duty = round(Math.min(0.3, p.duty + 0.02) * 100) / 100; p.stability = clamp(p.stability - 1, 0, 100);
    for (const t of ledger.treaties) if (t.kind === "trade" && t.parties.includes(p.id)) addGrudge(ledger, t.parties.find(x => x !== p.id)!, p.id, 3);
    record(ledger, { kind: "raise-duty", text: `${name} поднимает пошлину.`, powers: [p.id], scope: "public", knownBy: [] });
  });
  if (p.duty > 0) add("lower-duty", 0, () => { p.duty = round(Math.max(0, p.duty - 0.02) * 100) / 100; p.stability = clamp(p.stability + 0.5, 0, 100); record(ledger, { kind: "lower-duty", text: `${name} снижает пошлину.`, powers: [p.id], scope: "public", knownBy: [] }); });
  // При шаткой власти за реформу берутся редко, но берутся: и она срывается.
  if (p.treasury >= REFORM_COST) add("reform", p.stability <= 30 ? -3 : 0, () => {
    p.treasury -= REFORM_COST;
    // Реформа без стабильности срывается: при 30 и ниже шанса нет.
    const success = random() < clamp((p.stability - 30) / 50, 0, 0.9);
    p.stability = clamp(p.stability + (success ? 8 : -6), 0, 100);
    record(ledger, { kind: "reform", text: success ? `${name} проводит реформу.` : `Реформа в ${name} срывается.`, powers: [p.id], scope: "public", knownBy: [] });
  });
  for (const other of Object.values(ledger.powers)) {
    if (other.id === p.id) continue;
    const mutual = treatyValue(def, ledger, p.id, other.id) > 0 && treatyValue(def, ledger, other.id, p.id) > 0;
    if (mutual && !hasTreaty(ledger, p.id, other.id, "trade") && ready("treaty")) add("treaty", treatyValue(def, ledger, p.id, other.id) / 10, () => {
      ledger.treaties.push({ id: `tr${ledger.nextFact}`, parties: [p.id, other.id], kind: "trade", sinceDay: ledger.day });
      other.last.treaty = ledger.day;
      record(ledger, { kind: "treaty", text: `${name} и ${nameOf(def, other.id)} заключают торговый договор.`, powers: [p.id, other.id], scope: "public", knownBy: [] });
    }, other.id);
    // Тайный сговор: у обеих обида на одну третью державу, и друг на друга обида меньше выгоды.
    const common = Object.keys(ledger.powers).filter(x => x !== p.id && x !== other.id && grudgeOf(ledger, p.id, x) >= 20 && grudgeOf(ledger, other.id, x) >= 20);
    if (common.length && mutual && !hasTreaty(ledger, p.id, other.id, "secret-pact")) {
      const against = common.sort((x, y) => grudgeOf(ledger, p.id, y) - grudgeOf(ledger, p.id, x))[0]!;
      add("secret-pact", 2, () => {
        ledger.treaties.push({ id: `sp${ledger.nextFact}`, parties: [p.id, other.id], kind: "secret-pact", sinceDay: ledger.day, against });
        other.last["secret-pact"] = ledger.day;
        record(ledger, { kind: "secret-pact", text: `${name} и ${nameOf(def, other.id)} тайно сговариваются против ${nameOf(def, against)}.`, powers: [p.id, other.id], scope: "secret", knownBy: [p.id, other.id] });
      }, other.id);
    }
  }
  // Стычка на границе: стоит зерна, серебра и людей обеим сторонам. Без запасов не начинается.
  const canFight = p.grain >= SKIRMISH_NEEDS.grain && p.treasury >= SKIRMISH_NEEDS.treasury && p.troops >= SKIRMISH_NEEDS.troops;
  if (canFight) for (const n of pdef.neighbors) {
    const g = grudgeOf(ledger, p.id, n);
    const enemy = ledger.powers[n];
    if (!enemy || g < 40 || hasTreaty(ledger, p.id, n)) continue;
    add("skirmish", g / 20, () => {
      p.grain -= 40; p.treasury -= 30;
      const lossA = round(0.5 + random()), lossB = round(0.5 + random());
      p.troops = Math.max(0, round(p.troops - lossA)); enemy.troops = Math.max(0, round(enemy.troops - lossB));
      p.stability = clamp(p.stability - 2, 0, 100); enemy.stability = clamp(enemy.stability - 3, 0, 100);
      addGrudge(ledger, n, p.id, 15); addGrudge(ledger, p.id, n, 5);
      record(ledger, { kind: "skirmish", text: `На границе ${name} и ${nameOf(def, n)} стычка.`, powers: [p.id, n], scope: "public", knownBy: [] });
    }, n);
  }
  return out;
}

/** Один игровой день книги. Повтор уже прожитого дня ничего не меняет. */
export function stepRealmDay(def: RealmDefinition, input: RealmLedger, day: number): RealmLedger {
  if (day <= input.day) return input;
  const ledger: RealmLedger = structuredClone(input);
  stepInPlace(def, ledger, day);
  return ledger;
}

function stepInPlace(def: RealmDefinition, ledger: RealmLedger, day: number) {
  ledger.day = day;
  for (const pdef of def.powers) {
    const p = ledger.powers[pdef.id];
    if (!p) continue;
    // Экономика: войско ест зерно и серебро, пошлина приносит доход.
    p.grain = round(p.grain + pdef.harvestPerDay - pdef.grainUsePerDay - p.troops * 0.02);
    p.treasury = round(p.treasury + pdef.incomePerDay * (1 + p.duty) + ledger.treaties.filter(t => t.kind === "trade" && t.parties.includes(p.id)).length * 0.2 - p.troops * 0.05);
    // Двор, чиновники и подношения съедают часть казны: богатство не копится бесконечно.
    p.treasury = round(p.treasury * (1 - TREASURY_UPKEEP));
    if (p.grain < 0) { p.grain = 0; p.stability = clamp(p.stability - 1, 0, 100); }
    if (p.treasury < 0) { p.treasury = 0; p.stability = clamp(p.stability - 0.5, 0, 100); }
    // Сытая и платёжеспособная держава понемногу успокаивается к своему обычному уровню.
    else if (p.grain > 0 && p.stability < pdef.start.stability) p.stability = round(Math.min(pdef.start.stability, p.stability + STABILITY_RECOVERY));
  }
  // Договор рвётся, когда обида перекрыла выгоду хотя бы у одной стороны.
  for (const t of [...ledger.treaties]) {
    const [a, b] = t.parties;
    if (t.kind !== "trade" || (treatyValue(def, ledger, a, b) > -10 && treatyValue(def, ledger, b, a) > -10)) continue;
    ledger.treaties = ledger.treaties.filter(x => x !== t);
    record(ledger, { kind: "treaty-broken", text: `Торговый договор ${nameOf(def, a)} и ${nameOf(def, b)} разорван.`, powers: [a, b], scope: "public", knownBy: [] });
  }
  for (const g of ledger.grudges) g.weight = round(Math.max(0, g.weight - GRUDGE_DECAY_PER_DAY));
  ledger.grudges = ledger.grudges.filter(g => g.weight > 0);
  for (const pdef of def.powers) {
    const p = ledger.powers[pdef.id];
    if (!p) continue;
    if (day >= p.goalUntilDay) { p.goal = chooseGoal(def, ledger, p); p.goalUntilDay = day + 365; }
    const random = rng(ledger.seed, day, p.id);
    const best = options(def, ledger, p, random).sort((a, b) => b.score - a.score)[0];
    if (best && best.score >= 3) { best.run(); p.last[best.kind] = day; }
    p.treasury = round(p.treasury); p.grain = round(p.grain); p.troops = round(p.troops);
  }
  // Фракции: при шаткой власти те, кто метит на трон, сговариваются. Знает только сама фракция.
  for (const f of Object.values(ledger.factions)) {
    const p = ledger.powers[f.powerId];
    if (!p) continue;
    const random = rng(ledger.seed, day, f.id);
    f.strength = round(clamp(f.strength + (p.stability < 50 ? 0.1 : -0.05) + (random() - 0.5) * 0.2, 0, 100));
    if (f.aim === "throne" && !f.plot && p.stability < 35 && f.strength >= 30) {
      f.plot = { against: p.ruler, sinceDay: day };
      record(ledger, { kind: "plot", text: `Фракция «${def.factions.find(x => x.id === f.id)?.name ?? f.id}» сговаривается против: ${p.ruler}.`, powers: [p.id], scope: "secret", knownBy: [f.id] });
    }
    if (f.plot && p.stability >= 60) delete f.plot;
  }
}

/** Прожить книгу до минуты: по одному ходу на каждый наступивший игровой день. */
export function advanceRealm(def: RealmDefinition, ledger: RealmLedger, toMinute: number): RealmLedger {
  const target = dayOf(toMinute);
  if (target <= ledger.day) return ledger;
  const current: RealmLedger = structuredClone(ledger);
  for (let day = ledger.day + 1; day <= target; day++) stepInPlace(def, current, day);
  return current;
}

/** Что из книги уже довёз носитель до поселения. Всё остальное не для игрока и не для модели. */
export const realmFactsReached = (ledger: RealmLedger | undefined, settlementId: string) => (ledger?.facts ?? []).filter(f => f.reached.includes(settlementId));
