import type { ActionProposer } from "../engine/ai";
import { buildIntentEnvelope, type IntentContext } from "../engine/intent";
import type { SceneEnvelope, SceneWriter } from "../engine/speech";
import type { UnlockedKeySession } from "./keyVault";

/** Провайдеры, которые понимает server/ai-proxy.mjs. */
export const AI_PROVIDERS = [
  { id: "anthropic", label: "Claude (Anthropic)" },
  { id: "openai", label: "OpenAI" },
  { id: "deepseek", label: "DeepSeek" },
  { id: "openrouter", label: "OpenRouter" }
] as const;
export type AiProviderId = typeof AI_PROVIDERS[number]["id"];
export const isAiProviderId = (value: string): value is AiProviderId => AI_PROVIDERS.some(p => p.id === value);

/**
 * Транспорт до серверного прокси (server/ai-proxy.mjs). Ключ игрока, если он разблокирован,
 * передаётся только в заголовке одного запроса; без ключа прокси использует серверный ключ
 * или честно отвечает, что ИИ не настроен.
 */
export class ProxyActionProposer implements ActionProposer, SceneWriter {
  constructor(
    private readonly endpoint: string,
    private readonly session?: UnlockedKeySession,
    private readonly options: { provider?: AiProviderId; model?: string; timeoutMs?: number; onUsage?: (usage: { input: number; output: number }) => void } = {}
  ) {}

  propose(context: IntentContext, playerText: string): Promise<unknown> {
    return this.post(buildIntentEnvelope(context, playerText));
  }

  /** Живая сцена: реплики NPC пишет модель, движок затем проверяет и записывает их. */
  writeScene(envelope: SceneEnvelope): Promise<unknown> {
    return this.post(envelope);
  }

  private async post(envelope: object): Promise<unknown> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    // Свой ключ уходит только по HTTPS или на локальный прокси, иначе его можно перехватить в сети.
    if (this.session?.isUnlocked && !isSafeEndpoint(this.endpoint)) throw new Error("Ключ игрока отправляется только по HTTPS или на localhost.");
    this.session?.withKey(key => { headers["X-Player-Api-Key"] = key; });
    // Провайдер своего ключа важнее выбранного в списке: ключ OpenAI нельзя отправить в DeepSeek.
    const provider = this.session?.provider ?? this.options.provider;
    if (provider) headers["X-Ai-Provider"] = provider;
    if (this.options.model?.trim()) headers["X-Ai-Model"] = this.options.model.trim();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 45_000);
    try {
      const response = await fetch(`${this.endpoint.replace(/\/$/, "")}/api/ai/propose`, { method: "POST", headers, body: JSON.stringify({ envelope }), signal: controller.signal });
      const payload = await response.json().catch(() => ({})) as { proposal?: unknown; error?: string; usage?: { input: number; output: number } };
      if (!response.ok) throw new Error(payload.error ?? `Прокси ответил ${response.status}`);
      if (payload.usage) this.options.onUsage?.(payload.usage);
      return payload.proposal ?? null;
    } finally {
      clearTimeout(timer);
    }
  }
}

export function isSafeEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  } catch { return false; }
}
