/**
 * Правдоподобие (0.16.1): игрок пишет попытку, исход решает движок.
 *
 * «Я влюбил её в себя», «убедил стражника», «пробудил в себе силу» нельзя сделать словами.
 * Чувства и воля другого человека принадлежат ему: движок бросает проверку по обаянию героя,
 * отношению и характеру человека и возрасту обоих, а рассказчик потом описывает уже решённый итог.
 * Сверхспособностей в мире нет: такая «попытка» ничего не меняет.
 */
import type { GameState, NpcDef, Relation, WorldData } from "./types";
import { addressedNpc, heroAgeYears, npcAgeYears, shortName } from "./speech";
import { deriveNpcPersonality } from "./personality";
import { applyRelationDelta } from "./relations";

export type ClaimKind = "charm" | "persuade" | "power";

const CHARM = /влюби(л|ла|ть)\s+(\S+\s+)?в\s+себя|(заставил|заставила|вынудил|вынудила)\s+\S+\s+(влюбиться|полюбить|возжелать|захотеть)|\b(он|она)\s+(влюбил(ся|ась)|без ума от)|(очаровал|очаровала|соблазнил|соблазнила|обольстил|обольстила|покорил|покорила|вскружил|вскружила)/i;
const PERSUADE = /(убедил|убедила|уговорил|уговорила|заставил|заставила|подчинил|подчинила|запугал|запугала)\s+(его|её|ее|их|\S+)/i;
const POWER = /(пробудил|пробудила|пробужда\S*|обрёл|обрел|обрела|обрета\S*|открыл|открыла|открываю)\s+(в\s+себе\s+)?(\S+\s+)?(сил|маги|дар|способност)|магическ|заклинани|колду|колдовств|телепорт|сверхсил|бессмерт|(стал|стала)\s+(сильнее\s+всех|непобедим|всемогущ|бессмерт)|взлетел|взлетела|читаю\s+мысли|прочитал[а]?\s+(его|её|ее)\s+мысли/i;

export function detectOutcomeClaim(text: string): ClaimKind | null {
  const t = text.toLocaleLowerCase("ru");
  if (POWER.test(t)) return "power";
  if (CHARM.test(t)) return "charm";
  if (PERSUADE.test(t)) return "persuade";
  return null;
}

export interface AttemptOutcome {
  kind: ClaimKind;
  targetId?: string;
  result: "impossible" | "fail" | "slight" | "success";
  /** Короткий итог для хроники и рассказчика, на «вы» не пишется: это правило мира. */
  rule: string;
  /** Что видит игрок сразу. */
  playerNote: string;
  relation?: Partial<Relation>;
}

/** Детерминированный бросок: один и тот же ход в ту же минуту даёт тот же исход. */
function roll(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** Обаяние героя по шкале 0..1 из задатка «Харизма» (внутренняя шкала 1–30). */
const charmOf = (state: GameState) => Math.max(0, Math.min(1, ((state.playerProfile?.attributes?.["Харизма"] ?? 14) - 4) / 24));

export function resolveAttempt(world: WorldData, state: GameState, text: string, witnesses: string[]): AttemptOutcome | null {
  const kind = detectOutcomeClaim(text);
  if (!kind) return null;
  if (kind === "power") return {
    kind, result: "impossible",
    rule: "Никакой силы не появляется: в мире нет способностей, которые можно пробудить словами. Всё вокруг остаётся прежним.",
    playerNote: "Ничего не происходит. Сверхспособностей в этом мире нет."
  };
  const targetId = addressedNpc(world, witnesses, text) ?? witnesses[0];
  if (!targetId) return { kind, result: "fail", rule: "Рядом нет никого, на кого это могло бы подействовать.", playerNote: "Рядом никого нет." };
  const npc = world.npcs[targetId] as NpcDef;
  const name = shortName(npc);
  const hero = heroAgeYears(state) ?? 18;
  const other = npcAgeYears(npc, state) ?? 30;
  const rel = state.relations[targetId] ?? { trust: 0, sympathy: 0, fear: 0, respect: 0 };
  const traits = (npc.personality ?? deriveNpcPersonality(npc)).traits;

  if (kind === "charm" && (hero < 18 || other < 18)) {
    // Никакой романтики с детьми и у ребёнка: это детская выходка или неуместность, не влюблённость.
    return {
      kind, targetId, result: "fail",
      rule: hero < 18 && other >= 18 ? `${name} видит в этом детскую выходку. Никакой влюблённости нет и быть не может.` : `${name} не воспринимает это всерьёз. Никакой влюблённости не возникает.`,
      playerNote: `${name} не воспринимает это всерьёз.`
    };
  }

  const charm = charmOf(state);
  const warmth = traits.warmth / 100, suspicion = traits.suspicion / 100, assert = traits.assertiveness / 100;
  const base = kind === "charm"
    ? 0.15 + charm * 0.45 + rel.sympathy / 250 + rel.trust / 400 + warmth * 0.1 - suspicion * 0.15
    : 0.2 + charm * 0.35 + rel.trust / 200 + rel.respect / 300 + rel.fear / 400 - assert * 0.2 - suspicion * 0.1 - (hero < 12 && other >= 18 ? 0.2 : 0);
  const chance = Math.max(0.02, Math.min(0.85, base));
  const r = roll(`${state.minute}:${targetId}:${text}`);
  const verb = kind === "charm" ? "очаровать" : "убедить";
  if (r < chance * 0.35) return {
    kind, targetId, result: "success", relation: kind === "charm" ? { sympathy: 6, trust: 2 } : { trust: 3, respect: 2 },
    rule: kind === "charm" ? `Попытка ${verb} ${name} отчасти удалась: ${name} смотрит на героя теплее, но это ещё не любовь. Дальше решает сам ${name} по своему характеру.` : `Попытка ${verb} ${name} удалась: ${name} готов(а) согласиться, если это не против собственных интересов.`,
    playerNote: kind === "charm" ? `${name} смотрит на вас теплее. Это ещё не любовь.` : `${name}, похоже, готов(а) согласиться.`
  };
  if (r < chance) return {
    kind, targetId, result: "slight", relation: kind === "charm" ? { sympathy: 2 } : { trust: 1 },
    rule: `Попытка ${verb} ${name} почти не подействовала: ${name} заметил(а) её, но остаётся при своём.`,
    playerNote: `${name} заметил(а), но остаётся при своём.`
  };
  return {
    kind, targetId, result: "fail", relation: kind === "charm" ? { sympathy: -3, respect: -2 } : { trust: -2 },
    rule: `Попытка ${verb} ${name} не удалась: ${name} не поддаётся${suspicion > 0.55 ? " и начинает подозревать героя" : ""}.`,
    playerNote: `${name} не поддаётся.`
  };
}

/** Применяет итог к отношениям. */
export function applyAttempt(state: GameState, outcome: AttemptOutcome): GameState {
  if (!outcome.targetId || !outcome.relation) return state;
  const current = state.relations[outcome.targetId] ?? { trust: 0, sympathy: 0, fear: 0, respect: 0 };
  return { ...state, relations: { ...state.relations, [outcome.targetId]: applyRelationDelta(current, outcome.relation) } };
}
