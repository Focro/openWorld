/**
 * OpenWorld RPG: серверный прокси ИИ (0.15.0).
 *
 * Зачем он нужен:
 *  - ключ провайдера не попадает в JavaScript-бандл игры и в репозиторий;
 *  - здесь ограничиваются расходы (запросы в минуту и в сутки на клиента, размер запроса, max_tokens);
 *  - модель только ПРЕДЛАГАЕТ действие: прокси возвращает JSON-предложение,
 *    а движок игры сам проверяет его по правилам (engine/ai.ts: coerceProposal + allowedActionsFor);
 *  - реплики NPC пишет модель (протокол openworld-scene-v1), а движок проверяет, кто говорит,
 *    и записывает сказанное в память свидетелей (engine/speech.ts).
 *
 * Провайдеры: anthropic (Claude, официальный SDK), openai, deepseek, openrouter
 * (у трёх последних OpenAI-совместимый HTTP API /chat/completions).
 * Провайдер выбирается заголовком X-Ai-Provider, по умолчанию AI_PROVIDER.
 *
 * Два режима ключа:
 *  1. Серверный ключ: ANTHROPIC_API_KEY / OPENAI_API_KEY / DEEPSEEK_API_KEY / OPENROUTER_API_KEY
 *     (секреты хостинга, не в git).
 *  2. Свой ключ игрока (BYOK): заголовок X-Player-Api-Key. Ключ используется только для одного
 *     запроса, не логируется и не сохраняется. В браузере он хранится зашифрованным паролем игрока
 *     (src/ai/keyVault.ts). Только со своим ключом игрок может выбрать модель (X-Ai-Model):
 *     с серверным ключом модель всегда задаёт сервер, чтобы не раздувать расходы.
 *
 * Запуск:  cd server && npm install && ANTHROPIC_API_KEY=... npm start
 * Переменные: см. .env.example в корне проекта.
 */
import http from "node:http";
import Anthropic from "@anthropic-ai/sdk";

export const config = {
  port: Number(process.env.AI_PROXY_PORT ?? 8787),
  defaultProvider: process.env.AI_PROVIDER ?? "anthropic",
  effort: process.env.AI_EFFORT ?? "low",
  // Ответ — короткий JSON действия; большой лимит только тратит деньги игрока.
  maxTokens: Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 200),
  // Живая сцена: 1-2 реплики NPC и короткая ремарка. Длиннее не нужно, иначе ответы раздуваются.
  sceneMaxTokens: Number(process.env.AI_MAX_SCENE_TOKENS ?? 400),
  maxBodyBytes: 64 * 1024,
  perMinute: Number(process.env.AI_MAX_REQUESTS_PER_MINUTE ?? 6),
  perDay: Number(process.env.AI_MAX_REQUESTS_PER_DAY ?? 300),
  allowedOrigins: (process.env.AI_ALLOWED_ORIGINS ?? "http://localhost:5173").split(",").map(s => s.trim()).filter(Boolean),
  allowPlayerKeys: (process.env.AI_ALLOW_PLAYER_KEYS ?? "true") === "true"
};

/**
 * Описание провайдеров. Модели по умолчанию задаются переменными окружения; для OpenAI и OpenRouter
 * значения по умолчанию нет: модель нужно указать на сервере или выбрать в игре со своим ключом.
 */
export const PROVIDERS = {
  anthropic: { label: "Claude (Anthropic)", kind: "anthropic", keyEnv: "ANTHROPIC_API_KEY", model: env => env.AI_ANTHROPIC_MODEL ?? env.AI_MODEL ?? "claude-opus-5-5" },
  openai: { label: "OpenAI", kind: "openai-compatible", baseUrl: "https://api.openai.com/v1", tokenField: "max_completion_tokens", keyEnv: "OPENAI_API_KEY", model: env => env.AI_OPENAI_MODEL },
  deepseek: { label: "DeepSeek", kind: "openai-compatible", baseUrl: "https://api.deepseek.com", tokenField: "max_tokens", keyEnv: "DEEPSEEK_API_KEY", model: env => env.AI_DEEPSEEK_MODEL ?? "deepseek-chat" },
  openrouter: { label: "OpenRouter", kind: "openai-compatible", baseUrl: "https://openrouter.ai/api/v1", tokenField: "max_tokens", keyEnv: "OPENROUTER_API_KEY", model: env => env.AI_OPENROUTER_MODEL }
};
const MODEL_NAME = /^[A-Za-z0-9._:/-]{1,100}$/;

/** Какой провайдер, ключ и модель использовать. При ошибке возвращает { error, status }. */
export function resolveTarget(headers, env = process.env, allowPlayerKeys = config.allowPlayerKeys) {
  const header = name => (typeof headers[name] === "string" ? headers[name].trim() : "");
  const providerId = header("x-ai-provider") || config.defaultProvider;
  const provider = Object.hasOwn(PROVIDERS, providerId) ? PROVIDERS[providerId] : undefined;
  if (!provider) return { error: "Неизвестный провайдер ИИ.", status: 400 };
  const playerKey = allowPlayerKeys ? header("x-player-api-key") : "";
  const apiKey = playerKey || env[provider.keyEnv];
  if (!apiKey) return { error: `ИИ не настроен: для «${provider.label}» нет ключа сервера и не передан ключ игрока. Игра продолжает работать без ИИ.`, status: 503 };
  const requested = header("x-ai-model");
  if (requested && !MODEL_NAME.test(requested)) return { error: "Некорректное имя модели.", status: 400 };
  const model = (playerKey && requested) || provider.model(env);
  if (!model) return { error: `Для «${provider.label}» не задана модель: укажите её в настройках игры (со своим ключом) или на сервере.`, status: 503 };
  return { providerId, provider, apiKey, model };
}

/** Простое ограничение частоты в памяти процесса. Для нескольких инстансов нужен общий стор (Redis и т. п.). */
export function createRateLimiter({ perMinute, perDay }, now = () => Date.now()) {
  const buckets = new Map();
  return function allow(clientId) {
    const t = now();
    const b = buckets.get(clientId) ?? { minute: [], dayStart: t, dayCount: 0 };
    if (t - b.dayStart >= 86_400_000) { b.dayStart = t; b.dayCount = 0; }
    b.minute = b.minute.filter(ts => t - ts < 60_000);
    if (b.minute.length >= perMinute) { buckets.set(clientId, b); return { ok: false, reason: "Слишком часто: подождите минуту." }; }
    if (b.dayCount >= perDay) { buckets.set(clientId, b); return { ok: false, reason: "Дневной лимит запросов к ИИ исчерпан." }; }
    b.minute.push(t); b.dayCount += 1; buckets.set(clientId, b);
    return { ok: true };
  };
}

/** Проверка формы конверта, который строит engine/ai.ts → buildAiPromptEnvelope. */
export function validateEnvelope(body) {
  if (!body || typeof body !== "object") return "Пустой запрос.";
  const env = body.envelope;
  if (!env || !["openworld-ai-context-v1", "openworld-intent-v1", SCENE_PROTOCOL].includes(env.protocol)) return "Неизвестный протокол контекста.";
  if (typeof env.playerText !== "string" || !env.playerText.trim() || env.playerText.length > 1000) return "Текст игрока: от 1 до 1000 символов.";
  if (!Array.isArray(env.systemInstructions) || !env.context || !env.outputContract) return "Неполный контекст.";
  if (env.protocol === SCENE_PROTOCOL) return Array.isArray(env.outputContract.speakers) ? null : "Не указан список говорящих.";
  if (!Array.isArray(env.outputContract.allowedActions)) return "Не указан список допустимых действий.";
  return null;
}

/** Достаёт первый JSON-объект из текста модели. Всё остальное игнорируется. */
export function extractProposal(text) {
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

/** Стабильная часть запроса: одинакова между ходами, поэтому кэшируется у провайдеров, которые это умеют. */
export const SCENE_PROTOCOL = "openworld-scene-v1";
const isScene = envelope => envelope.protocol === SCENE_PROTOCOL;
export const maxTokensFor = envelope => isScene(envelope) ? config.sceneMaxTokens : config.maxTokens;

export function buildSystemPrompt(envelope) {
  if (isScene(envelope)) return [
    ...envelope.systemInstructions,
    "Ответь ТОЛЬКО одним JSON-объектом: {\"replies\":[{\"npc\":\"id\",\"text\":\"...\"}],\"narration\":\"...\"}. npc берётся только из speakers."
  ].join("\n");
  return [
    ...envelope.systemInstructions,
    "Ответь ТОЛЬКО одним JSON-объектом без пояснений. Поле \"type\" обязательно и берётся из списка acts / allowedActions.",
    "Если намерение невозможно по возрасту, месту или фактам, верни {\"type\":\"look\"}."
  ].join("\n");
}
const userContent = envelope => JSON.stringify({ context: envelope.context, playerText: envelope.playerText });

/** Claude через официальный SDK. */
async function callAnthropic(target, envelope) {
  const client = new Anthropic({ apiKey: target.apiKey, timeout: 60_000, maxRetries: 1 });
  try {
    const response = await client.beta.messages.create({
      model: target.model,
      max_tokens: maxTokensFor(envelope),
      output_config: { effort: config.effort },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      cache_control: { type: "ephemeral" },
      system: buildSystemPrompt(envelope),
      messages: [{ role: "user", content: userContent(envelope) }]
    });
    if (response.stop_reason === "refusal") return { refused: true };
    const text = response.content.filter(block => block.type === "text").map(block => block.text).join("\n");
    return { text, usage: { input: response.usage.input_tokens, output: response.usage.output_tokens } };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return { status: 401 };
    if (error instanceof Anthropic.RateLimitError) return { status: 429 };
    if (error instanceof Anthropic.BadRequestError) return { status: 400 };
    if (error instanceof Anthropic.APIError) return { status: 502, detail: error.status };
    return { status: 502 };
  }
}

/** Тело запроса для OpenAI, DeepSeek и OpenRouter (OpenAI-совместимый /chat/completions). */
export function buildChatCompletionsRequest(target, envelope) {
  return {
    model: target.model,
    [target.provider.tokenField]: maxTokensFor(envelope),
    messages: [{ role: "system", content: buildSystemPrompt(envelope) }, { role: "user", content: userContent(envelope) }]
  };
}

async function callOpenAiCompatible(target, envelope, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(`${target.provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${target.apiKey}` },
      body: JSON.stringify(buildChatCompletionsRequest(target, envelope)),
      signal: AbortSignal.timeout(60_000)
    });
  } catch { return { status: 502 }; }
  if (response.status === 401 || response.status === 403) return { status: 401 };
  if (response.status === 429) return { status: 429 };
  if (response.status === 400 || response.status === 404 || response.status === 422) return { status: 400 };
  if (!response.ok) return { status: 502, detail: response.status };
  const payload = await response.json().catch(() => null);
  const choice = payload?.choices?.[0];
  if (!choice) return { status: 502 };
  if (choice.finish_reason === "content_filter") return { refused: true };
  const text = typeof choice.message?.content === "string" ? choice.message.content : "";
  return { text, usage: { input: payload.usage?.prompt_tokens ?? 0, output: payload.usage?.completion_tokens ?? 0 } };
}

/** Единая точка вызова провайдера. Ключ и тело запроса никогда не пишутся в лог. */
export function callProvider(target, envelope, fetchImpl = fetch) {
  return target.provider.kind === "anthropic" ? callAnthropic(target, envelope) : callOpenAiCompatible(target, envelope, fetchImpl);
}

const PROVIDER_ERRORS = { 401: "Ключ отклонён провайдером.", 429: "Лимит провайдера. Повторите позже.", 400: "Провайдер отклонил запрос (проверьте имя модели)." };

function send(res, status, payload, origin) {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (origin && config.allowedOrigins.includes(origin)) Object.assign(headers, { "Access-Control-Allow-Origin": origin, Vary: "Origin" });
  res.writeHead(status, headers);
  res.end(JSON.stringify(payload));
}

const limiter = createRateLimiter(config);

export async function handle(req, res) {
  const origin = req.headers.origin;
  if (req.method === "OPTIONS") {
    if (!origin || !config.allowedOrigins.includes(origin)) return send(res, 403, { error: "origin" });
    res.writeHead(204, { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, GET", "Access-Control-Allow-Headers": "Content-Type, X-Player-Api-Key, X-Ai-Provider, X-Ai-Model", "Access-Control-Max-Age": "600", Vary: "Origin" });
    return res.end();
  }
  if (req.method === "GET" && req.url === "/api/ai/health") {
    const providers = Object.fromEntries(Object.entries(PROVIDERS).map(([id, p]) => [id, { label: p.label, serverKey: Boolean(process.env[p.keyEnv]), model: p.model(process.env) ?? null }]));
    return send(res, 200, { ok: true, defaultProvider: config.defaultProvider, playerKeys: config.allowPlayerKeys, providers }, origin);
  }
  if (req.method !== "POST" || req.url !== "/api/ai/propose") return send(res, 404, { error: "Не найдено." }, origin);
  if (origin && !config.allowedOrigins.includes(origin)) return send(res, 403, { error: "Источник запроса не разрешён." });

  const clientId = req.socket.remoteAddress ?? "unknown";
  const verdict = limiter(clientId);
  if (!verdict.ok) return send(res, 429, { error: verdict.reason }, origin);

  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > config.maxBodyBytes) return send(res, 413, { error: "Запрос слишком большой." }, origin);
  }
  let body;
  try { body = JSON.parse(raw); } catch { return send(res, 400, { error: "Некорректный JSON." }, origin); }
  const invalid = validateEnvelope(body);
  if (invalid) return send(res, 400, { error: invalid }, origin);

  const target = resolveTarget(req.headers);
  if (target.error) return send(res, target.status, { error: target.error }, origin);
  const result = await callProvider(target, body.envelope);
  if (result.refused) return send(res, 200, { proposal: null, refused: true }, origin);
  if (result.status) return send(res, result.status, { error: PROVIDER_ERRORS[result.status] ?? `Ошибка провайдера (${result.detail ?? "сеть"}).` }, origin);
  return send(res, 200, { proposal: extractProposal(result.text ?? ""), provider: target.providerId, usage: result.usage }, origin);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  http.createServer((req, res) => { handle(req, res).catch(() => send(res, 500, { error: "Внутренняя ошибка." })); })
    .listen(config.port, () => console.log(`OpenWorld AI proxy: http://localhost:${config.port} · провайдер по умолчанию ${config.defaultProvider}`));
}
