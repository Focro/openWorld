/**
 * Понимание свободного текста без нейросети и компактный пакет для ИИ (0.14.0).
 *
 * Цель: экономия токенов: большинство ходов разбирается здесь детерминированно,
 * а в ИИ уходит только то, что правда непонятно, и только нужный минимум сведений.
 *  1. understandFreeText: разбор обычной речи: «пойду на рынок», «что у меня в сумке»,
 *     «спрошу торговку о хлебе», опечатки в одну букву.
 *  2. buildIntentContext: короткий контекст: место, выходы, люди, товары, разрешённые действия.
 *     Сведения о мире добавляются только по ключевым словам (как «лорбуки»), не больше двух.
 */
import type { GameState, WorldData } from "./types";
import type { ParseResult } from "./parse";
import { normalize } from "./parse";
import { shortName } from "./speech";
import { npcsAt } from "./world";
import { capabilities, ageMonths, formatAge, type InfantActId } from "./development";
import { formatClock, formatWorldDate } from "./time";
import { buildTriggeredKnowledge } from "./knowledge";

const FILLER = new Set(["я", "хочу", "хотел", "хотела", "бы", "буду", "давай", "давайте", "пожалуйста", "попробую", "попробовать", "немного", "ещё", "еще", "тут", "здесь", "сейчас", "просто", "ну", "а", "и", "же", "тогда", "затем", "потом", "сначала", "можно", "надо", "нужно", "пора", "медленно", "быстро", "тихо", "осторожно"]);
const PREPOSITIONS = new Set(["в", "во", "на", "к", "ко", "до", "за", "у", "из", "с", "со", "по", "обратно", "назад", "туда"]);

const MOVE = /^(ид[уиё]|идти|пойд|пош[её]л|пошл|направ|отправ|бег[уи]|побег|зайт|зайд|захож|загляну|выйт|выйд|выхож|верн|двину|шага|прогуля|прой[дт]|перей[дт]|сход)/;
const LOOK = /^(осмотр|осматр|огляд|оглян|оглядыва|посмотр|смотрю|разгляд|озира)/;
const WAIT = /^(жд[уа]|ждать|подожд|обожд|отдох|передохн|посиж|постою|вздремн|отдыха)/;
const BUY = /^(куп|покуп|приобр|возьму|беру|закаж)/;
const SAY = /^(говор|скаж|сказа|спрос|спраш|крич|крикн|шепч|шепн|ответ|позов|обращ|поздоров|здорова|попрос|прошу|расскаж|поговор|заговор|окликн)/;
const GREETING = /^(привет|здравствуй|здравствуйте|добрый|доброе|доброго|салют|хай|спасибо|благодарю|прощай|до свидания)/;
const INFANT_STEMS: Array<[RegExp, InfantActId]> = [
  [/^(плач|запла|хныч|реву|рёв|рев[еу])/, "cry"], [/^(сплю|спать|усну|засып|засну|дрем)/, "sleep"],
  [/^(соса|сосу|голод|грудь|кушат|ест[ьи])/, "feed"], [/^(улыб)/, "smile"], [/^(агу|гул|лепеч|лепет)/, "babble"],
  [/^(тян|потян)/, "reach"], [/^(прижим|прижм|прильн|обним)/, "cling"], [/^(игра|поигра|тереблю|хватаю)/, "play"], [/^(смотр|глаз|разгляд|наблюд)/, "watch"]
];

/** Расстояние Левенштейна для коротких слов (опечатки). */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length]![b.length]!;
}
const TYPO_TARGETS: Array<[string, "look" | "inventory" | "wait"]> = [["осмотреться", "look"], ["оглядеться", "look"], ["инвентарь", "inventory"], ["подождать", "wait"]];

const stem = (word: string) => word.length > 5 ? word.slice(0, word.length - 2) : word.slice(0, Math.max(3, word.length - 1));

/** Ищет место среди выходов по корням слов: «на рынок» → «Нижний рынок». */
function matchPlace(world: WorldData, fromId: string, words: string[]): string | null {
  const exits = world.locations[fromId]?.exits ?? [];
  const wanted = words.filter(w => w.length >= 3 && !PREPOSITIONS.has(w)).map(stem);
  if (!wanted.length) return null;
  let best: { id: string; score: number } | null = null, tie = false;
  for (const exit of exits) {
    const name = normalize(world.locations[exit.to]?.name ?? exit.to).split(/[\s,--]+/).filter(Boolean);
    const score = wanted.filter(w => name.some(n => n.startsWith(w) || w.startsWith(stem(n)))).length;
    if (!score) continue;
    if (!best || score > best.score) { best = { id: exit.to, score }; tie = false; } else if (score === best.score) tie = true;
  }
  return best && !tie ? best.id : null;
}

function matchItem(world: WorldData, state: GameState, words: string[]): string | null {
  const shop = world.locations[state.playerLocation]?.shop;
  if (!shop) return null;
  const wanted = words.filter(w => w.length >= 3).map(stem);
  const hits = Object.keys(shop.prices).filter(id => {
    const name = normalize(world.items[id]?.name ?? id).split(" ");
    return wanted.some(w => name.some(n => n.startsWith(w) || w.startsWith(stem(n))));
  });
  return hits.length === 1 ? hits[0]! : null;
}

/**
 * Разбирает обычную речь игрока. Возвращает null, если уверенности нет: тогда текст может
 * уйти к ИИ (если он включён) или игрок получит подсказку. Ничего не выдумывает.
 */
export function understandFreeText(world: WorldData, state: GameState, text: string): ParseResult | null {
  const raw = text.trim();
  if (!raw) return null;
  const quoted = /[«"„“](.+?)[»"“”]/.exec(raw);
  const words = normalize(raw).replace(/[.,!?;:()«»"„“”…]/g, " ").split(" ").filter(w => w && !FILLER.has(w));
  if (!words.length) return null;
  const [verb = "", ...rest] = words;
  const caps = capabilities(state.development, state.minute);
  const infantStage = caps.infantActions.length > 0 && ageMonths(state.development!, state.minute) < 30;

  // Младенец: действия по корням слов («хнычу», «тянусь к маме»).
  if (infantStage) for (const [re, act] of INFANT_STEMS) if (re.test(verb) && caps.infantActions.includes(act)) return { ok: true, action: { type: "infant", act } };

  if (quoted && quoted[1]!.trim()) return { ok: true, action: { type: "say", text: quoted[1]!.trim() } };
  if (GREETING.test(verb)) return { ok: true, action: { type: "say", text: raw } };
  if (/^что$/.test(verb) && rest.some(w => /^(у|меня|при|себе|сумк|карман)/.test(w))) return { ok: true, action: { type: "inventory" } };
  if (/^(карман|сумк|котомк|рюкзак|вещи|пожитк)/.test(verb) || (/^(провер|посмотр|загляну)/.test(verb) && rest.some(w => /^(сумк|карман|вещ|котомк)/.test(w)))) return { ok: true, action: { type: "inventory" } };

  if (LOOK.test(verb) && (rest.length === 0 || rest.every(w => /^(вокруг|по|сторонам|кругом|комнат|мест)/.test(w)))) return { ok: true, action: { type: "look" } };
  if (WAIT.test(verb)) {
    const n = rest.find(w => /^\d+$/.test(w));
    const unit = rest.find(w => /^(мин|час|дн|сут)/.test(w)) ?? (n ? "мин" : "час");
    const count = n ? Number(n) : 1;
    const minutes = unit.startsWith("час") ? count * 60 : unit.startsWith("дн") || unit.startsWith("сут") ? count * 1440 : count;
    return { ok: true, action: { type: "wait", minutes: Math.max(1, Math.min(minutes, 7 * 1440)) } };
  }
  if (MOVE.test(verb)) {
    const to = matchPlace(world, state.playerLocation, rest);
    if (to) return { ok: true, action: { type: "move", to } };
    return null;
  }
  if (BUY.test(verb)) {
    const item = matchItem(world, state, rest);
    const qty = Number(rest.find(w => /^\d+$/.test(w)) ?? 1);
    if (item) return { ok: true, action: { type: "buy", item, qty: Math.max(1, Math.min(qty, 99)) } };
    return null;
  }
  if (SAY.test(verb)) {
    // «спросить торговку, сколько стоит хлеб» → реплика целиком: смысл реплики решает сцена, а не ИИ.
    const speech = raw.replace(/^\s*(я\s+)?\S+\s*(у\s+\S+|ей|ему|им|её|его|их)?\s*[,:]?\s*(что|о том, что|про|о|об)?\s*/i, "").trim() || raw;
    return { ok: true, action: { type: "say", text: speech.slice(0, 1000) } };
  }
  for (const [target, type] of TYPO_TARGETS) if (verb.length >= 6 && editDistance(verb, target) <= 1) {
    return type === "wait" ? { ok: true, action: { type: "wait", minutes: 60 } } : { ok: true, action: { type } };
  }
  return null;
}

/** Короткий контекст для разбора намерения. Описания и биографии сюда не входят. */
export interface IntentContext {
  t: string;
  age: string;
  here: string;
  exits: Array<[string, string]>;
  npcs: Array<[string, string]>;
  shop?: Array<[string, string, number]>;
  inv: Array<[string, number]>;
  money: number;
  acts: string[];
  facts?: string[];
}

export function buildIntentContext(world: WorldData, state: GameState, playerText: string, allowedActions: string[]): IntentContext {
  const loc = world.locations[state.playerLocation]!;
  const npcIds = npcsAt(world, state.minute, loc.id, state.npcDeaths);
  const facts = buildTriggeredKnowledge(world, state, playerText);
  return {
    t: `${formatWorldDate(state.minute, state.worldStartYearKL ?? 742)} ${formatClock(state.minute)}`,
    age: state.development ? `${capabilities(state.development, state.minute).stage.label}, ${formatAge(state.development, state.minute)}` : "взрослый",
    here: `${loc.id}|${loc.name}`,
    exits: loc.exits.map(e => [e.to, world.locations[e.to]?.name ?? e.to]),
    npcs: npcIds.map(id => [id, shortName(world.npcs[id]!)]),
    ...(loc.shop ? { shop: Object.entries(loc.shop.prices).map(([id, price]) => [id, world.items[id]?.name ?? id, price] as [string, string, number]) } : {}),
    inv: Object.entries(state.inventory).filter(([, q]) => q > 0),
    money: state.money,
    acts: allowedActions,
    ...(facts.length ? { facts } : {})
  };
}

export const INTENT_PROTOCOL = "openworld-intent-v1";
/** Стабильные инструкции: одинаковы между ходами, поэтому кэшируются у провайдеров. */
export const INTENT_INSTRUCTIONS = [
  "Ты переводишь фразу игрока текстовой RPG в одно игровое действие. Движок сам проверит, возможно ли оно.",
  "Используй только id из контекста: exits: куда идти, shop: что купить, npcs: кто рядом. Не выдумывай места, предметы и людей.",
  "Форматы: {type:look} {type:inventory} {type:wait,minutes} {type:move,to} {type:buy,item,qty} {type:say,text} {type:gesture,text} {type:infant,act} {type:live,days}.",
  "age: возраст персонажа: младенец не ходит и не говорит. acts: разрешённые сейчас действия."
];

export function buildIntentEnvelope(context: IntentContext, playerText: string) {
  return {
    protocol: INTENT_PROTOCOL,
    systemInstructions: INTENT_INSTRUCTIONS,
    context,
    playerText,
    outputContract: { type: "object" as const, required: ["type"], allowedActions: context.acts }
  };
}
