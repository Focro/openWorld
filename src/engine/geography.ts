import type { Terrain } from "./types";

export type Transport = "walk" | "horse" | "cart";

/** Скорость по ровной дороге, метров в минуту (пешком ≈ 4,8 км/ч). */
export const BASE_SPEED_M_PER_MIN: Record<Transport, number> = { walk: 80, horse: 200, cart: 120 };

/**
 * Множитель скорости по местности. 0 — транспорт не проходит
 * (например, телега по лесу).
 */
export const TERRAIN_FACTOR: Record<Terrain, Record<Transport, number>> = {
  street:   { walk: 1,    horse: 1,    cart: 1 },
  road:     { walk: 1,    horse: 1,    cart: 1 },
  path:     { walk: 0.85, horse: 0.8,  cart: 0 },
  forest:   { walk: 0.5,  horse: 0.4,  cart: 0 },
  mountain: { walk: 0.35, horse: 0.25, cart: 0 },
  swamp:    { walk: 0.3,  horse: 0.2,  cart: 0 }
};

export const TERRAINS = Object.keys(TERRAIN_FACTOR) as Terrain[];

/**
 * Время в пути в минутах (округляется вверх) или null, если не пройти / данные неверны.
 * Пока не учитываются погода, усталость и опасность маршрута — это следующие шаги.
 */
export function travelMinutes(distanceM: number, terrain: Terrain, transport: Transport): number | null {
  if (!Number.isFinite(distanceM) || distanceM <= 0) return null;
  const factor = TERRAIN_FACTOR[terrain]?.[transport];
  const speed = BASE_SPEED_M_PER_MIN[transport];
  if (!factor || !speed) return null;
  return Math.max(1, Math.ceil(distanceM / (speed * factor)));
}
