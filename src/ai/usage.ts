/**
 * Учёт расходов на ИИ в этом браузере: сколько запросов ушло сегодня, сколько токенов,
 * сколько ходов понято без ИИ или взято из кэша. Есть дневной лимит запросов игрока.
 */
export interface AiUsageDay {
  day: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cacheHits: number;
  understoodLocally: number;
}
const KEY = "openworld.ai.usage.v1";
const today = () => new Date().toISOString().slice(0, 10);
const empty = (): AiUsageDay => ({ day: today(), requests: 0, inputTokens: 0, outputTokens: 0, cacheHits: 0, understoodLocally: 0 });

export function loadUsage(storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): AiUsageDay {
  try {
    const parsed = JSON.parse(storage?.getItem(KEY) ?? "null") as AiUsageDay | null;
    return parsed && parsed.day === today() ? parsed : empty();
  } catch { return empty(); }
}
export function recordUsage(patch: Partial<Omit<AiUsageDay, "day">>, storage: Pick<Storage, "getItem" | "setItem"> | undefined = globalThis.localStorage): AiUsageDay {
  const current = loadUsage(storage);
  const next: AiUsageDay = { ...current };
  for (const [k, v] of Object.entries(patch) as Array<[keyof Omit<AiUsageDay, "day">, number]>) next[k] += v;
  try { storage?.setItem(KEY, JSON.stringify(next)); } catch { /* хранилище недоступно */ }
  return next;
}
