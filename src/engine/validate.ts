import { TERRAINS } from "./geography";
import type { WorldData } from "./types";

const isPosInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n > 0;

/**
 * Проверка целостности данных мира. Возвращает список ошибок (пустой — данные корректны).
 * Нужна, чтобы кривой мир (в том числе созданный в будущем редакторе или сгенерированный ИИ)
 * не попал в игру.
 */
export function validateWorld(world: WorldData): string[] {
  const errors: string[] = [];
  const { locations, items, npcs } = world;

  if (!locations[world.startLocationId]) errors.push(`Стартовая локация «${world.startLocationId}» не существует.`);
  if (!Number.isInteger(world.startMoney) || world.startMoney < 0) errors.push("Стартовые деньги: целое число ≥ 0.");
  for (const [id, n] of Object.entries(world.startInventory)) {
    if (!items[id]) errors.push(`Стартовый инвентарь: нет предмета «${id}».`);
    if (!isPosInt(n)) errors.push(`Стартовый инвентарь: количество «${id}» должно быть целым > 0.`);
  }

  for (const [key, item] of Object.entries(items)) {
    if (item.id !== key) errors.push(`Предмет «${key}»: id не совпадает с ключом.`);
  }

  for (const [key, loc] of Object.entries(locations)) {
    if (loc.id !== key) errors.push(`Локация «${key}»: id не совпадает с ключом.`);
    for (const e of loc.exits) {
      const target = locations[e.to];
      if (!target) { errors.push(`Локация «${key}»: выход в несуществующую «${e.to}».`); continue; }
      if (!isPosInt(e.distanceM)) errors.push(`Путь ${key}→${e.to}: расстояние должно быть целым > 0 м.`);
      if (!TERRAINS.includes(e.terrain)) errors.push(`Путь ${key}→${e.to}: неизвестная местность «${e.terrain}».`);
      const back = target.exits.find((x) => x.to === key);
      if (!back) errors.push(`Путь ${key}→${e.to}: нет обратного пути.`);
      else if (back.distanceM !== e.distanceM) errors.push(`Путь ${key}↔${e.to}: расстояния туда и обратно различаются.`);
    }
    if (loc.shop) {
      if (!npcs[loc.shop.keeperId]) errors.push(`Магазин в «${key}»: нет продавца «${loc.shop.keeperId}».`);
      for (const [itemId, price] of Object.entries(loc.shop.prices)) {
        if (!items[itemId]) errors.push(`Магазин в «${key}»: нет предмета «${itemId}».`);
        if (!isPosInt(price)) errors.push(`Магазин в «${key}»: цена «${itemId}» должна быть целой > 0.`);
      }
    }
  }

  for (const [key, npc] of Object.entries(npcs)) {
    if (npc.id !== key) errors.push(`NPC «${key}»: id не совпадает с ключом.`);
    if (!locations[npc.homeId]) errors.push(`NPC «${key}»: дом «${npc.homeId}» не существует.`);
    for (const s of npc.schedule) {
      if (!locations[s.locationId]) errors.push(`NPC «${key}»: в расписании несуществующая локация «${s.locationId}».`);
      const okHour = (h: number) => Number.isInteger(h) && h >= 0 && h <= 24;
      if (!okHour(s.from) || !okHour(s.to)) errors.push(`NPC «${key}»: часы расписания должны быть целыми 0–24.`);
    }
  }
  return errors;
}
