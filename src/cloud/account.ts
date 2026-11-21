/**
 * Аккаунты и облако (0.17.0): Supabase.
 *
 * Что лежит в облаке и зачем:
 * - profiles: дата рождения (ставится один раз), взрослый режим (база сама не пустит младше 18), бан.
 * - saves: сохранения игры, только свои (RLS). Слот "auto" это автосохранение.
 * - api_keys: ключ ИИ ТОЛЬКО в зашифрованном виде (тот же шифротекст, что в браузере). Пароль не уходит никуда.
 * - moderation_strikes: предупреждения пишет функция report_child_safety_strike, бан на четвёртом.
 *
 * Адрес проекта и открытый ключ приходят из переменных сборки VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.
 * Это публичный ключ (его защищает RLS), но в репозиторий он всё равно не кладётся.
 * Без них игра работает как раньше, только локально.
 */
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import type { EncryptedKeyRecord } from "../ai/keyVault";

export type Cloud = SupabaseClient;

let cached: Cloud | null | undefined;
/** Клиент Supabase или null, если сборка без настроек облака. */
export function getCloud(): Cloud | null {
  if (cached !== undefined) return cached;
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const url = env.VITE_SUPABASE_URL?.trim(), key = env.VITE_SUPABASE_ANON_KEY?.trim();
  cached = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } }) : null;
  return cached;
}

/** Куда вернуться после входа: та же страница игры (адреса заданы в настройках Supabase). */
export const redirectUrl = (): string => {
  try { return new URL((import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/", globalThis.location.origin).toString(); }
  catch { return "/"; }
};

export interface Profile { id: string; displayName: string | null; birthDate: string | null; adultMode: boolean; banned: boolean }

/** Понятный текст ошибки на русском вместо кода базы. */
export function friendlyError(error: unknown): string {
  const text = error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : String(error ?? "");
  if (/birth_date_locked/.test(text)) return "Дату рождения можно указать только один раз. Если она неверна, напишите автору игры.";
  if (/adult_mode_requires_18/.test(text)) return "Взрослый режим доступен только с 18 лет.";
  if (/row-level security|violates row-level/i.test(text)) return "Облако отказало: доступ закрыт.";
  if (/api_keys_ciphertext_check|check constraint/i.test(text)) return "Облако не приняло запись: ключ должен быть зашифрован.";
  if (/Invalid login credentials/i.test(text)) return "Неверная почта или пароль.";
  if (/Email not confirmed/i.test(text)) return "Почта ещё не подтверждена: откройте письмо и нажмите ссылку.";
  if (/rate limit|too many/i.test(text)) return "Слишком много попыток. Подождите немного и попробуйте снова.";
  if (/Failed to fetch|NetworkError|network/i.test(text)) return "Нет связи с облаком. Проверьте интернет.";
  return text ? `Облако ответило ошибкой: ${text}` : "Неизвестная ошибка облака.";
}
const fail = (error: unknown): never => { throw new Error(friendlyError(error)); };

// ===== вход =====
export async function signInWithGoogle(cloud: Cloud): Promise<void> {
  const { error } = await cloud.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectUrl() } });
  if (error) fail(error);
}
/** Вход по ссылке из письма: без пароля. */
export async function signInWithEmailLink(cloud: Cloud, email: string): Promise<void> {
  const clean = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error("Проверьте адрес почты.");
  const { error } = await cloud.auth.signInWithOtp({ email: clean, options: { emailRedirectTo: redirectUrl() } });
  if (error) fail(error);
}
export async function signOut(cloud: Cloud): Promise<void> { await cloud.auth.signOut(); }
export async function currentSession(cloud: Cloud): Promise<Session | null> {
  const { data } = await cloud.auth.getSession();
  return data.session;
}

// ===== профиль =====
export async function fetchProfile(cloud: Cloud, userId: string): Promise<Profile | null> {
  const { data, error } = await cloud.from("profiles").select("id, display_name, birth_date, adult_mode, banned_at").eq("id", userId).maybeSingle();
  if (error) fail(error);
  if (!data) return null;
  const row = data as { id: string; display_name: string | null; birth_date: string | null; adult_mode: boolean; banned_at: string | null };
  return { id: row.id, displayName: row.display_name, birthDate: row.birth_date, adultMode: row.adult_mode, banned: Boolean(row.banned_at) };
}
export async function saveBirthDate(cloud: Cloud, userId: string, birthDate: string): Promise<void> {
  const { error } = await cloud.from("profiles").update({ birth_date: birthDate }).eq("id", userId);
  if (error) fail(error);
}
export async function saveAdultMode(cloud: Cloud, userId: string, on: boolean): Promise<void> {
  const { error } = await cloud.from("profiles").update({ adult_mode: on }).eq("id", userId);
  if (error) fail(error);
}

// ===== сохранения =====
export const AUTO_SLOT = "auto";
/** Список умерших героев (окончательная смерть) лежит отдельной записью, общей для всех миров. */
export const GRAVEYARD_WORLD = "_account", GRAVEYARD_SLOT = "graveyard";
/** База принимает до 1 МБ на сохранение; с запасом режем раньше. */
export const MAX_CLOUD_SAVE_CHARS = 900_000;
export interface CloudSaveInfo { worldId: string; slot: string; updatedAt: string }

export async function putCloudSave(cloud: Cloud, worldId: string, slot: string, payloadJson: string): Promise<void> {
  if (payloadJson.length > MAX_CLOUD_SAVE_CHARS) throw new Error("Сохранение слишком большое для облака. Сохраните игру файлом.");
  const { error } = await cloud.from("saves").upsert({ world_id: worldId, slot, schema_version: 1, data: JSON.parse(payloadJson) }, { onConflict: "user_id,world_id,slot" });
  if (error) fail(error);
}
export async function listCloudSaves(cloud: Cloud): Promise<CloudSaveInfo[]> {
  const { data, error } = await cloud.from("saves").select("world_id, slot, updated_at").order("updated_at", { ascending: false });
  if (error) fail(error);
  return ((data ?? []) as Array<{ world_id: string; slot: string; updated_at: string }>).map(r => ({ worldId: r.world_id, slot: r.slot, updatedAt: r.updated_at }));
}
/** Возвращает JSON сохранения в том же виде, что файл или автосохранение. */
export async function getCloudSave(cloud: Cloud, worldId: string, slot: string): Promise<string | null> {
  const { data, error } = await cloud.from("saves").select("data").eq("world_id", worldId).eq("slot", slot).maybeSingle();
  if (error) fail(error);
  return data ? JSON.stringify((data as { data: unknown }).data) : null;
}

// ===== ключ ИИ (только шифротекст) =====
export async function putCloudKey(cloud: Cloud, record: EncryptedKeyRecord): Promise<void> {
  const { error } = await cloud.from("api_keys").upsert({ provider: record.provider, version: record.version, salt: record.salt, iv: record.iv, ciphertext: record.ciphertext, iterations: record.iterations }, { onConflict: "user_id,provider" });
  if (error) fail(error);
}
export async function getCloudKey(cloud: Cloud): Promise<EncryptedKeyRecord | null> {
  const { data, error } = await cloud.from("api_keys").select("provider, version, salt, iv, ciphertext, iterations, created_at").order("updated_at", { ascending: false }).limit(1);
  if (error) fail(error);
  const row = (data ?? [])[0] as { provider: string; version: number; salt: string; iv: string; ciphertext: string; iterations: number; created_at: string } | undefined;
  if (!row || row.version !== 1) return null;
  return { version: 1, provider: row.provider, salt: row.salt, iv: row.iv, ciphertext: row.ciphertext, iterations: row.iterations, createdAt: row.created_at };
}
export async function deleteCloudKeys(cloud: Cloud): Promise<void> {
  const { data } = await cloud.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) return;
  const { error } = await cloud.from("api_keys").delete().eq("user_id", uid);
  if (error) fail(error);
}

// ===== защита детей =====
export async function reportChildSafetyStrike(cloud: Cloud, reason: string): Promise<{ strikes: number; banned: boolean }> {
  const { data, error } = await cloud.rpc("report_child_safety_strike", { reason: reason.slice(0, 200) });
  if (error) fail(error);
  const row = (Array.isArray(data) ? data[0] : data) as { strikes?: number; banned?: boolean } | undefined;
  return { strikes: Number(row?.strikes) || 0, banned: row?.banned === true };
}
