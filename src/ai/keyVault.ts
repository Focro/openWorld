/**
 * Хранилище API-ключа игрока, защищённое его собственным паролем.
 *
 * Модель угроз и честные ограничения:
 * - Ключ хранится в браузере ТОЛЬКО в зашифрованном виде (AES-GCM, ключ шифрования
 *   выводится из пароля через PBKDF2-SHA-256, 310 000 итераций, случайная соль).
 * - Пароль нигде не сохраняется. Без пароля зашифрованная запись бесполезна.
 * - Расшифрованный ключ живёт только в памяти вкладки и забывается при закрытии
 *   или по кнопке «Заблокировать».
 * - Если игрок пользуется СВОИМ ключом, ключ неизбежно проходит через его браузер
 *   в момент запроса. Защита в том, что он не лежит открытым текстом, не попадает
 *   в исходники/репозиторий и уходит только на наш серверный прокси по HTTPS.
 * - Вредоносное расширение браузера или XSS на странице может перехватить ключ
 *   в момент использования. Поэтому прокси должен ограничивать расходы.
 */

export interface EncryptedKeyRecord {
  version: 1;
  provider: string;
  /** base64 */
  salt: string;
  iv: string;
  ciphertext: string;
  iterations: number;
  createdAt: string;
}

export const VAULT_STORAGE_KEY = "openworld.ai.vault.v1";
const PBKDF2_ITERATIONS = 310_000;
export const MIN_PASSWORD_LENGTH = 10;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(length));
  crypto.getRandomValues(bytes);
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export function passwordProblems(password: string): string[] {
  const problems: string[] = [];
  if (password.length < MIN_PASSWORD_LENGTH) problems.push(`Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов.`);
  if (!/[A-Za-zА-Яа-яЁё]/.test(password) || !/\d/.test(password)) problems.push("Используйте и буквы, и цифры.");
  return problems;
}

/** Шифрует API-ключ паролем игрока. Пароль не сохраняется. */
export async function encryptApiKey(apiKey: string, password: string, provider: string): Promise<EncryptedKeyRecord> {
  const problems = passwordProblems(password);
  if (problems.length) throw new Error(problems.join(" "));
  if (!apiKey.trim()) throw new Error("Ключ пустой.");
  const salt = randomBytes(16), iv = randomBytes(12);
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  // Провайдер входит в AAD: подменить его в сохранённой записи без пароля нельзя.
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(provider) }, key, encoder.encode(apiKey.trim())));
  return { version: 1, provider, salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(ciphertext), iterations: PBKDF2_ITERATIONS, createdAt: new Date().toISOString() };
}

/** Расшифровывает ключ. Неверный пароль или изменённая запись дают ошибку, а не мусор. */
export async function decryptApiKey(record: EncryptedKeyRecord, password: string): Promise<string> {
  if (record.version !== 1) throw new Error("Неизвестная версия хранилища ключа.");
  const key = await deriveKey(password, fromBase64(record.salt), record.iterations);
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(record.iv), additionalData: encoder.encode(record.provider) }, key, fromBase64(record.ciphertext));
    return decoder.decode(plain);
  } catch {
    throw new Error("Неверный пароль или запись ключа повреждена.");
  }
}

/** Безопасная работа с localStorage: в приватном режиме хранилище может быть недоступно. */
export function loadVaultRecord(storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): EncryptedKeyRecord | null {
  try {
    const raw = storage?.getItem(VAULT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EncryptedKeyRecord;
    return parsed.version === 1 && typeof parsed.ciphertext === "string" ? parsed : null;
  } catch { return null; }
}
export function saveVaultRecord(record: EncryptedKeyRecord, storage: Pick<Storage, "setItem"> | undefined = globalThis.localStorage): boolean {
  try { storage?.setItem(VAULT_STORAGE_KEY, JSON.stringify(record)); return Boolean(storage); } catch { return false; }
}
export function clearVaultRecord(storage: Pick<Storage, "removeItem"> | undefined = globalThis.localStorage): void {
  try { storage?.removeItem(VAULT_STORAGE_KEY); } catch { /* хранилище недоступно */ }
}

/** Ключ в памяти на время сессии. Не сериализуется и не попадает в сохранения игры. */
export class UnlockedKeySession {
  #key: string | null = null;
  #provider: string | null = null;
  unlock(provider: string, key: string) { this.#provider = provider; this.#key = key; }
  lock() { this.#key = null; this.#provider = null; }
  get isUnlocked() { return this.#key !== null; }
  get provider() { return this.#provider; }
  /** Ключ выдаётся только транспортному слою запроса к прокси. */
  withKey<T>(use: (key: string, provider: string) => T): T | null {
    return this.#key && this.#provider ? use(this.#key, this.#provider) : null;
  }
  toJSON() { return { unlocked: this.isUnlocked, provider: this.#provider }; }
}
