/**
 * Автосохранение (0.16.0): игра сама запоминает, где вы остановились.
 * Пишется в браузер после каждого хода (с небольшой задержкой) и при сворачивании вкладки.
 * Когда появятся аккаунты, сюда же подключится облачное сохранение.
 */
import type { GameState } from "../engine/types";

export const AUTOSAVE_KEY = "openworld.autosave.v1";
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
const store = (): Storage | undefined => { try { return globalThis.localStorage; } catch { return undefined; } };

export interface AutosaveInfo { ok: boolean; savedAt?: string; bytes?: number }

/** Сохраняет только настоящую кампанию: пустой демо-мир до создания героя не нужен. */
export function writeAutosave(worldId: string, game: GameState, storage: Storage | undefined = store(), now = new Date()): AutosaveInfo {
  if (!game.playerProfile || !storage) return { ok: false };
  const text = JSON.stringify({ schemaVersion: 1, worldId, game, savedAt: now.toISOString() });
  // Последняя игра и отдельная копия для каждого мира: сохранения идут по мирам.
  try { storage.setItem(AUTOSAVE_KEY, text); try { storage.setItem(`${AUTOSAVE_KEY}:${worldId}`, text); } catch { /* хватит и общей копии */ } return { ok: true, savedAt: now.toISOString(), bytes: text.length }; }
  catch { return { ok: false }; }
}

/** Без worldId: последняя игра; с worldId: последняя игра в этом мире. */
export function readAutosave(storage: Storage | undefined = store(), worldId?: string): string | null {
  try { return (worldId ? storage?.getItem(`${AUTOSAVE_KEY}:${worldId}`) : null) ?? (worldId ? null : storage?.getItem(AUTOSAVE_KEY)) ?? null; } catch { return null; }
}

/** С worldId: стирает сохранение этого мира (и общую копию, если она от него). */
export function clearAutosave(storage: Storage | undefined = store(), worldId?: string): void {
  try {
    if (!worldId) { storage?.removeItem(AUTOSAVE_KEY); return; }
    storage?.removeItem(`${AUTOSAVE_KEY}:${worldId}`);
    const last = storage?.getItem(AUTOSAVE_KEY);
    let lastWorld: unknown;
    try { lastWorld = last ? (JSON.parse(last) as { worldId?: unknown }).worldId : undefined; } catch { lastWorld = worldId; }
    if (last && (lastWorld === worldId || lastWorld === undefined)) storage?.removeItem(AUTOSAVE_KEY);
  } catch { /* хранилище недоступно */ }
}
