/** Выбранная игроком суровость мира. Параметры фиксируются при создании мира и не подстраиваются под успех игрока. */
export type WorldDifficultyId = "peaceful" | "balanced" | "harsh";
export interface WorldDifficulty {
  id: WorldDifficultyId;
  label: string;
  violenceRisk: number;
  diseaseRisk: number;
  scarcityRisk: number;
  legalSeverity: number;
  socialSuspicion: number;
  naturalAging: 1;
  adaptiveScaling: false;
  description: string;
}
export const WORLD_DIFFICULTIES: Record<WorldDifficultyId, WorldDifficulty> = {
  peaceful: {
    id: "peaceful", label: "Мирный",
    violenceRisk: 0.45, diseaseRisk: 0.7, scarcityRisk: 0.65, legalSeverity: 0.8, socialSuspicion: 0.8,
    naturalAging: 1, adaptiveScaling: false,
    description: "Меньше насилия и катастроф, выше доступность помощи. Законы, последствия и естественное старение сохраняются."
  },
  balanced: {
    id: "balanced", label: "Сбалансированный",
    violenceRisk: 1, diseaseRisk: 1, scarcityRisk: 1, legalSeverity: 1, socialSuspicion: 1,
    naturalAging: 1, adaptiveScaling: false,
    description: "Базовые условия мира без искусственного облегчения или ужесточения."
  },
  harsh: {
    id: "harsh", label: "Суровый",
    violenceRisk: 1.4, diseaseRisk: 1.25, scarcityRisk: 1.35, legalSeverity: 1.2, socialSuspicion: 1.2,
    naturalAging: 1, adaptiveScaling: false,
    description: "Опаснее дороги, чаще нехватка ресурсов и тяжелее последствия ошибок. Мир не подстраивает сложность динамически."
  }
};
export function getWorldDifficulty(id: WorldDifficultyId): WorldDifficulty {
  return WORLD_DIFFICULTIES[id];
}
