/**
 * Жители мест Ардана (0.19.0, предложение канона).
 *
 * Житель это обычный NpcDef плюс паспорт жителя: место, пол, день рождения, занятие,
 * семья и связи с другими людьми, короткий паспорт речи для ИИ и тайна, которую знает
 * только он сам. Готовых реплик здесь нет: слова пишет нейросеть по этим данным.
 *
 * Правила:
 *  - члены 30 домов из nobleHouses.ts здесь не дублируются, на них можно сослаться в links;
 *  - каноническим персонажам не придумываются родители, браки и наследники;
 *  - внешность по населению края (populations.ts), приезжие редки;
 *  - всё здесь помечено provenance: "proposal", пока автор не утвердил.
 */
import type { NpcDef } from "../../../engine/types";
import type { StateId } from "../populations";

/** Месяцы Велории по Библии мира, по 30 дней. */
export const VELORIA_MONTHS = ["Севень", "Талень", "Роса", "Цветень", "Зной", "Жатва", "Плодень", "Листопад", "Туман", "Стужа", "Снегень", "Последень"] as const;

export type ResidentLinkKind =
  | "spouse" | "widow-of" | "parent" | "child" | "sibling" | "grandparent" | "grandchild"
  | "employer" | "employee" | "master" | "apprentice" | "neighbor" | "friend" | "rival"
  | "creditor" | "debtor" | "former-comrade" | "patron" | "client" | "suspects" | "courting";

export interface ResidentLink {
  /** id другого жителя, существующего NPC мира или члена дома из nobleHouses.ts. */
  to: string;
  kind: ResidentLinkKind;
  /** Что это значит для них самих, одной строкой. */
  note?: string;
}

export interface ResidentPassport {
  settlementId: string;
  sex: "male" | "female";
  birth: { year: number; month: number; day: number };
  /** Где родился, если не здесь (id места из MAP_NODES). */
  birthplaceId?: string;
  occupation: string;
  /** Общее имя двора: люди с одним household живут под одной крышей. */
  household: string;
  /** Как выглядит человек целиком: рост, сложение, приметы. Цвета волос и глаз в appearance. */
  build: string;
  /** Паспорт речи для ИИ: как звучит человек. Не реплики. */
  speech: string;
  /** Повседневные мелочи, по которым его узнают. */
  quirks: string[];
  /** Чего боится. */
  fears: string[];
  /** Тайна: знает только он сам (и те, кто в links). Публичному ИИ не передаётся. */
  /** Тайны в публичный репозиторий не кладём: они хранятся в приватных документах проекта. */
  secret?: string;
  links: ResidentLink[];
  /** id веры из faiths.ts; "ancestors" для домашних культов предков, "none" для неверующих. */
  faith?: "sevenfold" | "path_of_wells" | "open_lantern" | "stone_oath" | "green_memory" | "imperial_sun" | "ancestors" | "none";
  provenance: "proposal";
}

export type ResidentDef = NpcDef & { originStateId: StateId; resident: ResidentPassport };
