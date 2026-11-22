import type { GameEvent, GameState, MemoryEntry } from "./types";
import { normalize } from "./parse";
import { MINUTES_PER_DAY } from "./time";

/**
 * Что человек вспоминает в этот ход. Модель между ходами ничего не хранит,
 * поэтому важное прошлое нужно заново класть в запрос каждый раз.
 * Берём не хвост ленты, а короткий отбор: метки про героя, совпадения со словами игрока, свежее.
 */
export const RECALL_LIMIT = 6;
export const RECALL_MIN = 4;
export const RECALL_CHARS = 120;
const FACTS_LIMIT = 3;
const MATCH_LIMIT = 2;
const FRESH_LIMIT = 2;

/**
 * Метки про героя: что человек видел сам. open ставит метку, close закрывает её
 * (вернул долг, простил). Пока последняя запись метки не закрывающая, метка открыта.
 */
interface Mark { id: string; open: RegExp; close?: RegExp }
const MARKS: Mark[] = [
  { id: "violence", open: /удар|бьет|(^|[^а-я])бил[аи]?([^а-я]|$)|избил|толкн|пощечин|ранил|напал|душил|пнул/, close: /простил|помирил/ },
  { id: "confession", open: /признал(ся|ась) в|люблю тебя|люблю вас|влюбл|поцелов|поцелуй/ },
  { id: "refusal", open: /отказ|отверг|не выйду|не пойду за|не могу быть с|не люблю тебя|не люблю вас|оставь меня|прогнал|не нужен мне|не нужна мне/, close: /согласил|передумал|простил|помирил/ },
  { id: "debt", open: /(^|[^а-я])долг(?!о|ий|ая|ое|ую|ого|ом|ие|их)|в долг|мне должен|мне должна|взаймы|ссуд/, close: /вернул|расплатил|погасил|в расчете|квиты/ },
  { id: "help", open: /помог|спас|выручил|заступил|вылечил/ },
  { id: "lie", open: /солгал|соврал|обманул|обман|ложь|лжец|врешь|врет/, close: /признал(ся|ась) во лжи|простил/ },
  { id: "theft", open: /украл|кража|стащил|(^|[^а-я])вор([^а-я]|$)|воровк/, close: /вернул|простил/ },
  { id: "threat", open: /угрож|пригрози|убью/, close: /извинил|помирил/ },
  { id: "promise", open: /обещ|поклял|клянусь/, close: /сдержал|выполнил/ }
];

const ROUTINE_TEXT = /обменялись несколькими словами в локации|оказались рядом в локации/;
const STOP = new Set(["это", "этот", "эта", "тебя", "тебе", "меня", "мне", "себя", "когда", "чтобы", "только", "тоже", "очень", "ещё", "еще", "здесь", "сейчас", "почему", "который", "которая", "просто", "давай", "нужно", "хочу", "можно", "будет", "было", "была", "есть", "свой", "своя", "твой", "твоя", "наш", "ваш", "вас", "нас", "они", "она", "оно", "что", "как", "где", "кто", "так", "там", "тут", "вот", "уже", "или", "если", "привет", "здравствуй", "здравствуйте"]);

const words = (text: string) => normalize(text).split(/[^a-zа-я0-9]+/).filter(Boolean);
const stems = (text: string) => [...new Set(words(text).filter(word => word.length >= 4 && !STOP.has(word)).map(word => word.slice(0, Math.max(4, word.length - 2))))];

function ago(minutes: number): string {
  const days = Math.floor(minutes / MINUTES_PER_DAY);
  if (days < 1) return "";
  if (days < 2) return "вчера: ";
  if (days < 30) return `${days} дн. назад: `;
  if (days < 365) return `${Math.floor(days / 30)} мес. назад: `;
  return `${Math.floor(days / 365)} г. назад: `;
}

const line = (entry: MemoryEntry, now: number) => {
  const text = `${ago(now - entry.minute)}${entry.text.replace(/^\[Итог по правилам:/, "[Итог:")}`;
  return text.length > RECALL_CHARS ? `${text.slice(0, RECALL_CHARS - 1)}…` : text;
};

export interface RecallOptions {
  /** События, уже лежащие в recent: их повторять в mem не нужно. */
  skipEventIds?: Set<string>;
}

/** Короткий список того, что этот человек помнит к этому ходу: 4-6 строк до 120 знаков. */
export function recallFor(state: GameState, npcId: string, playerText: string, options: RecallOptions = {}): string[] {
  const all = state.npcMemory[npcId] ?? [];
  if (!all.length) return [];
  const events = new Map<string, GameEvent>(state.chronicle.map(event => [event.id, event]));
  const skip = options.skipEventIds ?? new Set<string>();
  const isRoutine = (entry: MemoryEntry) => ROUTINE_TEXT.test(entry.text) || (entry.eventId !== undefined && events.get(entry.eventId)?.routine === true);
  const pool = all.map((entry, index) => ({ entry, index, text: normalize(entry.text) }))
    .filter(({ entry }) => !isRoutine(entry) && !(entry.eventId && skip.has(entry.eventId)));
  if (!pool.length) return [];

  const heroName = normalize(state.playerName).split(/\s+/)[0] ?? "";
  // Видел сам и это про героя: ход героя, сцена при нём или запись называет его.
  const aboutHero = (item: (typeof pool)[number]) => {
    if (item.entry.kind !== "witnessed") return false;
    const event = item.entry.eventId ? events.get(item.entry.eventId) : undefined;
    if (event?.source.kind === "player" || event?.withHero) return true;
    if (event?.source.kind === "npc" && !event.routine) return true;
    return heroName.length >= 3 && item.text.includes(heroName);
  };

  // Последняя запись каждой метки; закрытые метки уступают открытым.
  const marks: { item: (typeof pool)[number]; open: boolean }[] = [];
  for (const mark of MARKS) {
    for (let i = pool.length - 1; i >= 0; i--) {
      const item = pool[i]!;
      const closes = mark.close?.test(item.text) ?? false;
      if (!closes && !mark.open.test(item.text)) continue;
      if (!aboutHero(item)) continue;
      marks.push({ item, open: !closes });
      break;
    }
  }
  const facts = [...new Map(marks.sort((a, b) => Number(b.open) - Number(a.open) || b.item.index - a.item.index).map(m => [m.item.index, m.item])).values()];

  const chosen = new Map<number, (typeof pool)[number]>();
  const take = (items: (typeof pool)[number][], limit: number) => {
    let added = 0;
    for (const item of items) {
      if (added >= limit || chosen.size >= RECALL_LIMIT) break;
      if (chosen.has(item.index)) continue;
      chosen.set(item.index, item);
      added++;
    }
  };
  take(facts, FACTS_LIMIT);

  const asked = stems(playerText);
  if (asked.length) {
    const scored = pool.map(item => {
      const own = words(item.entry.text);
      return { item, score: asked.filter(stem => own.some(word => word.startsWith(stem))).length };
    }).filter(s => s.score > 0).sort((a, b) => b.score - a.score || b.item.index - a.item.index);
    take(scored.map(s => s.item), MATCH_LIMIT);
  }

  take([...pool].reverse(), FRESH_LIMIT);
  if (chosen.size < RECALL_MIN) take(facts, RECALL_MIN - chosen.size);
  if (chosen.size < RECALL_MIN) take([...pool].reverse(), RECALL_MIN - chosen.size);

  return [...chosen.values()].sort((a, b) => a.index - b.index).map(item => line(item.entry, state.minute));
}
