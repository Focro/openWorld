import type { Relation } from "./types";

export const REL_MIN = -100;
export const REL_MAX = 100;
/** Максимальное изменение одного параметра за одно событие: отношения меняются постепенно. */
export const MAX_STEP = 5;

export const neutralRelation = (): Relation => ({ trust: 0, sympathy: 0, fear: 0, respect: 0 });

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Применяет изменение к отношению: шаг ограничен ±MAX_STEP, итог: в [−100, 100]. Нечисла игнорируются. */
export function applyRelationDelta(rel: Relation, delta: Partial<Relation>): Relation {
  const next = { ...rel };
  for (const key of Object.keys(next) as (keyof Relation)[]) {
    const d = delta[key];
    if (typeof d !== "number" || !Number.isFinite(d)) continue;
    next[key] = clamp(Math.round(rel[key] + clamp(d, -MAX_STEP, MAX_STEP)), REL_MIN, REL_MAX);
  }
  return next;
}

/** Словесное описание отношения (для интерфейса и контекста ИИ). */
export function describeAttitude(rel: Relation): string {
  const parts: string[] = [];
  if (rel.fear >= 40) parts.push("боится");
  if (rel.trust >= 30) parts.push("доверяет");
  else if (rel.trust <= -30) parts.push("не доверяет");
  if (rel.sympathy >= 30) parts.push("симпатизирует");
  else if (rel.sympathy <= -30) parts.push("неприязненно относится");
  if (rel.respect >= 30) parts.push("уважает");
  else if (rel.respect <= -30) parts.push("презирает");
  return parts.length ? parts.join(", ") : "нейтрален";
}
