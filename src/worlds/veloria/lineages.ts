/** Совместимый вход для прежнего кода; основной реестр теперь содержит 30 домов. */
export { NOBLE_HOUSES, houseById, housesInState, visibleGenealogy, validateGenealogies } from "./nobleHouses";
import type { DynasticHouse } from "./nobleHouses";
export type NobleHouse = DynasticHouse;
export type HouseMember = DynasticHouse["members"][number];
export function validHouseParents(h: NobleHouse): boolean {
  const ids = new Set(h.members.map(m => m.id));
  return h.members.every(m => m.parentIds.every(p => ids.has(p) && p !== m.id) && m.ancestorIds.every(a => ids.has(a) && a !== m.id));
}
export const MERIT_TITLES = [
  {id:"banneret",title:"Земельный баннерет",authority:"Корона Эстрана",requirements:["военная или государственная заслуга","королевская грамота","ресурс для содержания службы"],privileges:["герб и малая усадьба"],limits:["не получает древних предков задним числом","наследование зависит от грамоты"]},
  {id:"pass_knight",title:"Рыцарь перевала",authority:"Конклав Тарвека",requirements:["защита горного прохода","свидетельства общин"],privileges:["земельный доход","командование заставой"],limits:["нет автоматического голоса в конклаве","служба обязательна"]}
] as const;
