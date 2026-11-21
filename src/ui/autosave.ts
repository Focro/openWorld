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
  try { storage.setItem(AUTOSAVE_KEY, text); return { ok: true, savedAt: now.toISOString(), bytes: text.length }; }
  catch { return { ok: false }; }
}

export function readAutosave(storage: Storage | undefined = store()): string | null {
  try { return storage?.getItem(AUTOSAVE_KEY) ?? null; } catch { return null; }
}

export function clearAutosave(storage: Storage | undefined = store()): void {
  try { storage?.removeItem(AUTOSAVE_KEY); } catch { /* хранилище недоступно */ }
}
