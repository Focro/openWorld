/**
 * ИИ напрямую из браузера, своим ключом игрока (без сервера-прокси).
 * Ключ живёт только в памяти вкладки и уходит только провайдеру, которого выбрал игрок.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { ActionProposer } from "../engine/ai";
import { buildIntentEnvelope, type IntentContext } from "../engine/intent";
import type { SceneEnvelope, SceneWriter } from "../engine/speech";
import type { AiProviderId } from "./proxyClient";

const SCENE_PROTOCOL = "openworld-scene-v1";
const OPENAI_LIKE: Record<Exclude<AiProviderId, "anthropic">, { url: string; tokenField: string }> = {
  openai: { url: "https://api.openai.com/v1", tokenField: "max_completion_tokens" },
  deepseek: { url: "https://api.deepseek.com", tokenField: "max_tokens" },
  openrouter: { url: "https://openrouter.ai/api/v1", tokenField: "max_tokens" }
};
export const DEFAULT_MODEL: Partial<Record<AiProviderId, string>> = { anthropic: "claude-opus-5-5", deepseek: "deepseek-chat" };

type Envelope = { protocol?: string; systemInstructions: string[]; context?: unknown; playerText?: string };
const isScene = (e: Envelope) => e.protocol === SCENE_PROTOCOL;
function systemPrompt(e: Envelope): string {
  return [...e.systemInstructions, isScene(e)
    ? "Ответь ТОЛЬКО одним JSON-объектом: {\"replies\":[{\"npc\":\"id\",\"text\":\"...\"}],\"narration\":\"...\"}. npc берётся только из speakers."
    : "Ответь ТОЛЬКО одним JSON-объектом без пояснений. Поле \"type\" обязательно и берётся из списка acts / allowedActions. Если намерение невозможно по возрасту, месту или фактам, верни {\"type\":\"look\"}."].join("\n");
}
function firstJson(text: string): unknown {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(text.slice(a, b + 1)); } catch { return null; }
}

export class AiError extends Error { constructor(public readonly kind: "key" | "model" | "limit" | "network", message: string) { super(message); } }

/** Один вызов модели: текст ответа или понятная ошибка. */
export async function callModel(provider: AiProviderId, key: string, model: string, system: string, user: string, maxTokens: number): Promise<{ text: string; usage: { input: number; output: number } }> {
  if (provider === "anthropic") {
    const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, timeout: 60_000, maxRetries: 1 });
    try {
      const r = await client.messages.create({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] });
      const text = r.content.flatMap(b => b.type === "text" ? [b.text] : []).join("\n");
      return { text, usage: { input: r.usage.input_tokens, output: r.usage.output_tokens } };
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new AiError("key", "Ключ не подошёл");
      if (e instanceof Anthropic.RateLimitError) throw new AiError("limit", "Лимит сервиса");
      if (e instanceof Anthropic.NotFoundError || e instanceof Anthropic.BadRequestError) throw new AiError("model", "Модель не найдена");
      throw new AiError("network", "Сервис не ответил");
    }
  }
  const p = OPENAI_LIKE[provider];
  let res: Response;
  try {
    res = await fetch(`${p.url}/chat/completions`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, [p.tokenField]: maxTokens, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
      signal: AbortSignal.timeout(60_000)
    });
  } catch { throw new AiError("network", "Сервис не ответил"); }
  if (res.status === 401 || res.status === 403) throw new AiError("key", "Ключ не подошёл");
  if (res.status === 402 || res.status === 429) throw new AiError("limit", "Лимит сервиса");
  if (res.status === 400 || res.status === 404 || res.status === 422) throw new AiError("model", "Модель не найдена");
  if (!res.ok) throw new AiError("network", "Сервис не ответил");
  const payload = await res.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } } | null;
  const text = payload?.choices?.[0]?.message?.content ?? "";
  return { text, usage: { input: payload?.usage?.prompt_tokens ?? 0, output: payload?.usage?.completion_tokens ?? 0 } };
}

export class DirectAi implements ActionProposer, SceneWriter {
  constructor(private readonly provider: AiProviderId, private readonly key: string, private readonly model: string, private readonly onUsage?: (u: { input: number; output: number }) => void) {}
  propose(context: IntentContext, playerText: string) { return this.ask(buildIntentEnvelope(context, playerText) as Envelope, 200); }
  writeScene(envelope: SceneEnvelope) { return this.ask(envelope as unknown as Envelope, 2000); }
  private async ask(e: Envelope, maxTokens: number): Promise<unknown> {
    const r = await callModel(this.provider, this.key, this.model, systemPrompt(e), JSON.stringify({ context: e.context, playerText: e.playerText }), maxTokens);
    this.onUsage?.(r.usage);
    return firstJson(r.text);
  }
}
