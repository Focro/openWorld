/**
 * Защита детей-персонажей (0.15.3).
 *
 * Правило автора проекта: сексуальные действия в отношении несовершеннолетних персонажей
 * недопустимы. Если игрок пытается их совершить, ход не выполняется, сцена прерывается,
 * игрок получает предупреждение; после трёх предупреждений следующая попытка ведёт к бану.
 *
 * Проверка идёт до любого разбора и до нейросети: запрос с таким текстом никуда не уходит.
 */
import type { GameState, WorldData } from "./types";
import { npcsAt } from "./world";
import { heroAgeYears, npcAgeYears } from "./speech";

const SEXUAL_INTENT = /секс|(^|[^а-яё])(по|от|вы)?трах(а|н|у|ну)|(^|[^а-яё])(вы|за|от|по)?еб[аёуи]|изнасил|насил(ую|ует)|совокуп|ласка(ю|ет)\s+(е[её]|его)\s+(груд|бедр|тел|ниж|интим)|(^|[^а-яё])(лапа|щупа|облапа)(ю|ет|л)|оральн|минет|мастурб|дроч|(в|на)\s+постел[ьи]\s+с|разде(ва)?(ю|ну|ть)\s+(е[её]|его)\s+(догола|донага)|целу(ю|ет)\s+(е[её]|его)\s+(в\s+губы|взасос|в\s+грудь)|\bsex|\bfuck|\brape|molest|grope|fondle|\bnaked\b|undress/i;

/** Есть ли в тексте сексуальное намерение. Слова обычной жизни («член совета», «грудь болит») не считаются. */
export const hasSexualIntent = (text: string): boolean => SEXUAL_INTENT.test(text.toLocaleLowerCase("ru"));

/** Есть ли в сцене несовершеннолетние: сам герой или кто-то рядом. */
export function minorsInScene(world: WorldData, state: GameState): { hero: boolean; nearby: string[] } {
  const heroAge = heroAgeYears(state);
  const nearby = npcsAt(world, state.minute, state.playerLocation, state.npcDeaths)
    .filter(id => { const age = npcAgeYears(world.npcs[id]!, state); return age !== undefined && age < 18; });
  return { hero: heroAge !== undefined && heroAge < 18, nearby };
}

/** Нарушение: сексуальное намерение там, где участвует ребёнок. */
export function isChildSafetyViolation(world: WorldData, state: GameState, text: string): boolean {
  if (!hasSexualIntent(text)) return false;
  const minors = minorsInScene(world, state);
  return minors.hero || minors.nearby.length > 0;
}

export const SAFETY_WARNINGS_BEFORE_BAN = 3;

export interface SafetyRecord { strikes: number; banned: boolean; lastStrikeAt?: string }

/**
 * Куда записывать предупреждения и бан. Сейчас аккаунтов нет, поэтому запись локальная
 * и её можно обойти, очистив браузер. Когда появятся аккаунты, сюда подключается серверная
 * запись (например, таблица в Supabase): бан будет привязан к аккаунту, а не к браузеру.
 */
export interface SafetyStore {
  load(): SafetyRecord;
  save(record: SafetyRecord): void;
  /** Отправка на сервер; без аккаунтов ничего не делает. */
  report?(record: SafetyRecord, reason: string): void;
}

const KEY = "openworld.safety.v1";
export function localSafetyStore(storage: Pick<Storage, "getItem" | "setItem"> | undefined = globalThis.localStorage): SafetyStore {
  return {
    load() {
      try {
        const raw = JSON.parse(storage?.getItem(KEY) ?? "null") as Partial<SafetyRecord> | null;
        return { strikes: Math.max(0, Number(raw?.strikes) || 0), banned: raw?.banned === true, ...(raw?.lastStrikeAt ? { lastStrikeAt: raw.lastStrikeAt } : {}) };
      } catch { return { strikes: 0, banned: false }; }
    },
    save(record) { try { storage?.setItem(KEY, JSON.stringify(record)); } catch { /* хранилище недоступно */ } }
  };
}

/** Записывает нарушение и возвращает текст для игрока. Четвёртое нарушение ведёт к бану. */
export function registerViolation(store: SafetyStore, now = new Date()): { record: SafetyRecord; message: string } {
  const prior = store.load();
  const strikes = prior.strikes + 1;
  const banned = prior.banned || strikes > SAFETY_WARNINGS_BEFORE_BAN;
  const record: SafetyRecord = { strikes, banned, lastStrikeAt: now.toISOString() };
  store.save(record);
  store.report?.(record, "child-safety");
  const message = banned
    ? "Сцена прервана. Это было после трёх предупреждений: доступ к игре закрыт."
    : `Сцена прервана. Сексуальные действия в отношении детей запрещены. Предупреждение ${strikes} из ${SAFETY_WARNINGS_BEFORE_BAN}. После третьего предупреждения следующая попытка закроет доступ к игре.`;
  return { record, message };
}

/** Полных лет на дату today по дате рождения (YYYY-MM-DD). null, если дата некорректна или в будущем. */
export function ageFromBirthDate(birthDate: string, today = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age--;
  if (age < 0 || age > 130) return null;
  return age;
}
