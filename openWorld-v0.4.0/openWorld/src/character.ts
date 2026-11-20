export const attributes = [
  "Сила", "Выносливость", "Ловкость", "Интеллект",
  "Восприятие", "Харизма", "Воля"
] as const;
export type Attribute = (typeof attributes)[number];

export const ATTRIBUTE_TOTAL = 100;
export const ATTRIBUTE_MIN = 1;
export const ATTRIBUTE_MAX = 30;

export interface CharacterDraft {
  name: string;
  concept: string;
  attributes: Record<string, number>;
}

export type Validation = { ok: true } | { ok: false; errors: string[] };

export const attributeSum = (attrs: Record<string, number>) =>
  Object.values(attrs).reduce((a, b) => a + b, 0);

/** Единственное правило допустимости сборки персонажа (используется и UI, и схемой). */
export function validateCharacter(draft: CharacterDraft): Validation {
  const errors: string[] = [];
  const name = draft.name.trim();
  if (name.length < 1 || name.length > 40) errors.push("Имя: от 1 до 40 символов.");
  if (draft.concept.length > 500) errors.push("Концепция: не более 500 символов.");

  const keys = Object.keys(draft.attributes);
  const missing = attributes.filter((a) => !keys.includes(a));
  const extra = keys.filter((k) => !(attributes as readonly string[]).includes(k));
  if (missing.length) errors.push(`Нет характеристик: ${missing.join(", ")}.`);
  if (extra.length) errors.push(`Лишние характеристики: ${extra.join(", ")}.`);

  for (const a of attributes) {
    const v = draft.attributes[a];
    if (v === undefined) continue;
    if (!Number.isInteger(v) || v < ATTRIBUTE_MIN || v > ATTRIBUTE_MAX)
      errors.push(`${a}: целое число от ${ATTRIBUTE_MIN} до ${ATTRIBUTE_MAX}.`);
  }
  if (!missing.length && !extra.length) {
    const sum = attributeSum(draft.attributes);
    if (sum !== ATTRIBUTE_TOTAL) errors.push(`Сумма характеристик должна быть ${ATTRIBUTE_TOTAL}, сейчас ${sum}.`);
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
