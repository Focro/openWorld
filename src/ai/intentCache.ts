import type { ActionProposer } from "../engine/ai";
import type { IntentContext } from "../engine/intent";
import { normalize } from "../engine/parse";

/**
 * Кэш намерений: одна и та же фраза в той же обстановке не отправляется в ИИ повторно.
 * Ключ учитывает место, выходы и разрешённые действия, поэтому ответ из кэша
 * всё равно подходит к ситуации; движок проверяет его так же, как свежий.
 */
const KEY = "openworld.ai.intent-cache.v1";
const MAX_ENTRIES = 300;
type Store = Pick<Storage, "getItem" | "setItem">;

export function intentCacheKey(context: IntentContext, playerText: string): string {
  return [normalize(playerText).replace(/[.,!?;:…]/g, ""), context.here, context.exits.map(e => e[0]).join(","), context.npcs.map(n => n[0]).join(","), context.acts.join(",")].join("|");
}

export class CachingProposer implements ActionProposer {
  constructor(private readonly inner: ActionProposer, private readonly onHit: () => void = () => {}, private readonly storage: Store | undefined = globalThis.localStorage) {}

  private read(): Array<[string, unknown]> {
    try { return JSON.parse(this.storage?.getItem(KEY) ?? "[]") as Array<[string, unknown]>; } catch { return []; }
  }
  private write(entries: Array<[string, unknown]>) {
    try { this.storage?.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES))); } catch { /* хранилище недоступно */ }
  }

  async propose(context: IntentContext, playerText: string): Promise<unknown> {
    const key = intentCacheKey(context, playerText);
    const entries = this.read();
    const hit = entries.find(([k]) => k === key);
    if (hit) { this.onHit(); return hit[1]; }
    const proposal = await this.inner.propose(context, playerText);
    if (proposal && typeof proposal === "object") this.write([...entries.filter(([k]) => k !== key), [key, proposal]]);
    return proposal;
  }
}
