/**
 * PIN-код вместо длинного пароля на своём устройстве.
 * Ключ ИИ шифруется дважды: ключом из PIN (PBKDF2) и ключом устройства (AES-GCM, не извлекаемый,
 * живёт в IndexedDB этого браузера). Без этого устройства PIN бесполезен: на новом устройстве
 * нужен пароль. После 5 неверных PIN запись стирается, дальше только пароль.
 */
const DB = "openworld-device", STORE = "keys", DEVICE = "device-key", BLOB = "openworld.ai.pin.v1", TRIES = "openworld.ai.pin.tries";
export const MAX_PIN_TRIES = 5;
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (b: ArrayBuffer | Uint8Array<ArrayBuffer>) => btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))));
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;

function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction(STORE, mode), req = run(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
      tx.oncomplete = () => open.result.close();
    };
  });
}
async function deviceKey(create: boolean): Promise<CryptoKey | null> {
  const found = await idb<CryptoKey | undefined>("readonly", s => s.get(DEVICE) as IDBRequest<CryptoKey | undefined>).catch(() => undefined);
  if (found || !create) return found ?? null;
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await idb("readwrite", s => s.put(key, DEVICE));
  return key;
}
async function pinKey(pin: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 310_000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
const seal = async (key: CryptoKey, data: Uint8Array<ArrayBuffer>) => { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data)); const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return out; };
const open = async (key: CryptoKey, data: Uint8Array<ArrayBuffer>) => new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: data.slice(0, 12) }, key, data.slice(12)));

export const isValidPin = (pin: string) => /^\d{4,6}$/.test(pin);
export function hasPin(): boolean { try { return !!localStorage.getItem(BLOB); } catch { return false; } }
export function forgetPin(): void { try { localStorage.removeItem(BLOB); localStorage.removeItem(TRIES); } catch { /* нет хранилища */ } }
export function pinTriesLeft(): number { try { return MAX_PIN_TRIES - Number(localStorage.getItem(TRIES) ?? 0); } catch { return MAX_PIN_TRIES; } }

/** Запомнить ключ на этом устройстве под PIN. */
export async function savePin(pin: string, secret: { provider: string; key: string; model: string }): Promise<void> {
  if (!isValidPin(pin)) throw new Error("PIN: от 4 до 6 цифр.");
  const device = await deviceKey(true);
  if (!device) throw new Error("Браузер не дал запомнить устройство.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const inner = await seal(await pinKey(pin, salt), enc.encode(JSON.stringify(secret)));
  const outer = await seal(device, inner);
  localStorage.setItem(BLOB, JSON.stringify({ salt: b64(salt), data: b64(outer) }));
  localStorage.removeItem(TRIES);
}

/** Открыть ключ PIN-кодом. null: неверный PIN (попытка засчитана) или записи больше нет. */
export async function unlockWithPin(pin: string): Promise<{ provider: string; key: string; model: string } | null> {
  const raw = (() => { try { return localStorage.getItem(BLOB); } catch { return null; } })();
  const device = await deviceKey(false);
  if (!raw || !device) { forgetPin(); return null; }
  const { salt, data } = JSON.parse(raw) as { salt: string; data: string };
  try {
    const inner = await open(device, unb64(data));
    const plain = await open(await pinKey(pin, unb64(salt)), inner);
    localStorage.removeItem(TRIES);
    return JSON.parse(dec.decode(plain));
  } catch {
    const tries = Number(localStorage.getItem(TRIES) ?? 0) + 1;
    if (tries >= MAX_PIN_TRIES) forgetPin(); else localStorage.setItem(TRIES, String(tries));
    return null;
  }
}
