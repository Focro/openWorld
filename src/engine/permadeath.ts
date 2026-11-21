/**
 * Окончательная смерть (0.18.0).
 *
 * Сохранения идут по мирам. Если герой умер, это навсегда: загрузить его живую копию
 * из старого файла или облака нельзя. Дальше только начать мир заново или создать нового героя.
 * Список умерших («погост») хранится в браузере и, при входе, в аккаунте.
 */
import type { GameState } from "./types";

export interface GraveRecord { lifeId: string; worldId: string; name: string; diedAtMinute: number; recordedAt: string }

/** Устойчивый номер жизни: создаётся при рождении, у старых сохранений выводится из рецепта кампании. */
export function lifeIdOf(state: GameState): string | null {
  if (state.lifeId) return state.lifeId;
  const recipe = state.campaign?.recipe as { draft?: { familySeed?: string; name?: string; age?: number } } | undefined;
  const d = recipe?.draft;
  if (!d?.familySeed) return null;
  return `legacy:${d.familySeed}:${d.name ?? ""}:${d.age ?? ""}`;
}

export function newLifeId(random: () => number = Math.random): string {
  const part = () => Math.floor(random() * 0x100000000).toString(36).padStart(7, "0");
  return `life-${Date.now().toString(36)}-${part()}${part()}`;
}

export const GRAVEYARD_KEY = "openworld.graveyard.v1";
type Store = Pick<Storage, "getItem" | "setItem">;
const local = (): Store | undefined => { try { return globalThis.localStorage; } catch { return undefined; } };

export function loadGraveyard(storage: Store | undefined = local()): GraveRecord[] {
  try {
    const raw = JSON.parse(storage?.getItem(GRAVEYARD_KEY) ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((r): r is GraveRecord => Boolean(r) && typeof (r as GraveRecord).lifeId === "string") : [];
  } catch { return []; }
}
export function saveGraveyard(records: GraveRecord[], storage: Store | undefined = local()): void {
  try { storage?.setItem(GRAVEYARD_KEY, JSON.stringify(records.slice(-500))); } catch { /* хранилище недоступно */ }
}
export function mergeGraveyards(a: GraveRecord[], b: GraveRecord[]): GraveRecord[] {
  const byId = new Map<string, GraveRecord>();
  for (const r of [...a, ...b]) if (!byId.has(r.lifeId)) byId.set(r.lifeId, r);
  return [...byId.values()];
}

/** Записывает смерть героя. Возвращает обновлённый список (или прежний, если запись уже есть). */
export function buryIfDead(worldId: string, state: GameState, records: GraveRecord[], now = new Date()): GraveRecord[] {
  const lifeId = lifeIdOf(state);
  if (state.lifeStatus !== "dead" || !lifeId || records.some(r => r.lifeId === lifeId)) return records;
  return [...records, { lifeId, worldId, name: state.playerName, diedAtMinute: state.deathRecord?.minute ?? state.minute, recordedAt: now.toISOString() }];
}

/** Можно ли загрузить это сохранение: живую копию умершего героя загрузить нельзя. */
export function loadBlockedByDeath(state: GameState, records: GraveRecord[]): GraveRecord | null {
  if (state.lifeStatus === "dead") return null;
  const lifeId = lifeIdOf(state);
  return lifeId ? records.find(r => r.lifeId === lifeId) ?? null : null;
}

export const DEATH_IS_FINAL_MESSAGE = (name: string) => `${name} умер(ла) в этом мире, и это навсегда. Старое сохранение не вернёт героя. Начните мир заново или создайте нового героя.`;
