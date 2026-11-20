import { z } from "zod";
import { ATTRIBUTE_MAX, ATTRIBUTE_MIN, ATTRIBUTE_TOTAL, attributes, attributeSum } from "./character";
import type { Attribute } from "./character";

export { attributes } from "./character";

const attributeValue = z.number().int().min(ATTRIBUTE_MIN).max(ATTRIBUTE_MAX);

export const CharacterSchema = z.object({
  name: z.string().trim().min(1).max(40),
  concept: z.string().max(500),
  // Ровно 7 известных атрибутов, лишние ключи запрещены.
  attributes: z.object(
    Object.fromEntries(attributes.map((a) => [a, attributeValue])) as Record<Attribute, typeof attributeValue>
  ).strict()
}).refine((v) => attributeSum(v.attributes) === ATTRIBUTE_TOTAL,
  `Сумма характеристик должна быть равна ${ATTRIBUTE_TOTAL}`);

export const WorldSchema = z.object({
  name: z.string().trim().min(1).max(60),
  genre: z.string(),
  era: z.string(),
  technology: z.string(),
  magic: z.string(),
  description: z.string().max(2000)
});

export type World = z.infer<typeof WorldSchema>;
export type Character = z.infer<typeof CharacterSchema>;
