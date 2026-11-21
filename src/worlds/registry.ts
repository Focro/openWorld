import type { WorldData } from "../engine/types";
import { defaultWorld } from "../engine/world";
import { createVeloriaWorld } from "./veloria/world";
import { buildVeloriaCampaignWorld, isVeloriaRecipe, legacyRecipeFromState } from "./veloria/campaign";
import { ensureDevelopment } from "../engine/development";
import type { GameState } from "../engine/types";

/** Каталог миров. Миры подключаются сюда по одному; сейчас активно развивается только Велория. */
export interface WorldEntry {
  id: string;
  name: string;
  subtitle: string;
  /** Каждый вызов возвращает независимую копию, чтобы игра не меняла каталог. */
  create: () => WorldData;
  /** Восстанавливает мир, собранный под конкретного персонажа, из рецепта в GameState.campaign. */
  rebuild?: (recipe: unknown) => WorldData | null;
  /** Доводит загруженное сохранение старой версии до текущего формата. */
  migrate?: (state: GameState) => GameState;
}

export const WORLDS: WorldEntry[] = [
  {
    id: "veloria",
    name: "Велория",
    subtitle: "Ровен, королевство Эстран (канон 1.1)",
    create: createVeloriaWorld,
    rebuild: recipe => isVeloriaRecipe(recipe) ? buildVeloriaCampaignWorld(recipe) : null,
    migrate: state => {
      const recipe = state.campaign ? null : legacyRecipeFromState(state);
      const withCampaign = recipe ? { ...state, campaign: { worldId: "veloria", recipe } } : state;
      return ensureDevelopment({ ...withCampaign, worldStartYearKL: withCampaign.worldStartYearKL ?? (withCampaign.playerProfile?.dynasticRole === "second-prince" ? 723 : 742) });
    }
  },
  {
    id: "demo",
    name: "Демо-мир",
    subtitle: "Маленький тестовый город",
    create: () => structuredClone(defaultWorld)
  }
];

export const DEFAULT_WORLD_ID = "veloria";

export const getWorldEntry = (id: string): WorldEntry | undefined => WORLDS.find((w) => w.id === id);

/** Мир для текущего состояния: собранный под персонажа, если есть рецепт, иначе базовый. */
export function resolveWorldForState(worldId: string, campaign: { worldId: string; recipe: unknown } | undefined): WorldData | null {
  const entry = getWorldEntry(worldId);
  if (!entry) return null;
  if (campaign && campaign.worldId === worldId && entry.rebuild) {
    const rebuilt = entry.rebuild(campaign.recipe);
    if (rebuilt) return rebuilt;
  }
  return entry.create();
}

/** Применяет миграцию мира к загруженному состоянию. */
export function migrateStateForWorld(worldId: string, state: GameState): GameState {
  const entry = getWorldEntry(worldId);
  return entry?.migrate ? entry.migrate(state) : ensureDevelopment(state);
}
