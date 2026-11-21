import type { NpcDef, WorldData, LocationDef } from "../../engine/types";
import { COUNTRIES, MAP_NODES } from "./atlas";
import { createAppearanceState } from "../../engine/appearance";
import { isStateId, regionalName, sampleResidentAppearance, seedHash } from "./populations";

/** Местный житель: имя и внешность по традиции и населению страны; приезжие встречаются редко. */
function localResident(countryId: string, nodeKind: string, seed: string, clothing: string) {
  const stateId = isStateId(countryId) ? countryId : "estran";
  const kind = nodeKind === "port" ? "port" : nodeKind === "capital" ? "capital" : nodeKind === "city" ? "city" : nodeKind === "village" ? "village" : "town";
  const look = sampleResidentAppearance(stateId, seed, kind);
  const sex = seedHash(`${seed}:sex`) % 2 === 0 ? "male" as const : "female" as const;
  const name = regionalName(look.originStateId, sex, seed).full;
  const appearance = createAppearanceState({
    skinTone: look.skinTone, naturalHairColor: look.hairColor, hairTexture: look.hairTexture, eyeColor: look.eyeColor, facialFeatures: look.facialFeatures
  }, { hairstyle: sex === "male" ? "коротко подстриженные волосы" : "волосы убраны от лица", clothing });
  return { name, appearance, originStateId: look.originStateId, foreign: look.originStateId !== stateId };
}


export function settlementGateLocationId(settlementId: string): string {
  return settlementId === "roven" ? "south-gate" : `atlas:${settlementId}:gate`;
}

/** Adds a small but playable local street layer for every mapped settlement except Roven, which has its authored map. */
export function attachSettlementMaps(source: WorldData): WorldData {
  const world: WorldData = {
    ...source,
    locations: { ...source.locations },
    npcs: { ...source.npcs }
  };

  for (const node of MAP_NODES) {
    if (node.id === "roven") continue;
    const country = COUNTRIES.find(item => item.id === node.countryId);
    const prefix = `atlas:${node.id}`;
    const squareId = `${prefix}:square`;
    const marketId = `${prefix}:market`;
    const innId = `${prefix}:inn`;
    const gateId = settlementGateLocationId(node.id);
    const gateName = node.kind === "port" ? "Пристань и таможня"
      : node.kind === "fort" ? "Крепостные ворота"
      : node.kind === "monastery" ? "Внешний двор"
      : "Городские ворота";
    const features = node.tags.join(", ");

    const localLocations: LocationDef[] = [
      { id: squareId, name: `${node.name} — центральная площадь`, description: `Центр поселения. Здесь сходятся местные дороги; вокруг видны признаки местной жизни: ${features}.`, exits: [
        { to: marketId, distanceM: 180, terrain: "street" }, { to: innId, distanceM: 260, terrain: "street" }, { to: gateId, distanceM: 420, terrain: "street" }
      ] },
      { id: marketId, name: `${node.name} — торговые ряды`, description: `Местный рынок ${node.name}. Ассортимент зависит от положения поселения в государстве ${country?.name ?? node.countryId}; характерные занятия: ${features}.`, exits: [
        { to: squareId, distanceM: 180, terrain: "street" }, { to: innId, distanceM: 220, terrain: "street" }
      ], shop: { keeperId: `${node.id}:merchant`, prices: { bread: 3, rope: 10, bandage: 6, wool_cloak: 20 } } },
      { id: innId, name: `${node.name} — постоялый двор`, description: `Постоялый двор для жителей, приезжих и обозов. Новости здесь распространяются быстрее, чем в тихих кварталах.`, exits: [
        { to: squareId, distanceM: 260, terrain: "street" }, { to: marketId, distanceM: 220, terrain: "street" }, { to: gateId, distanceM: 360, terrain: "street" }
      ] },
      { id: gateId, name: `${node.name} — ${gateName.toLocaleLowerCase("ru-RU")}`, description: `Вход и выход из поселения ${node.name}. Здесь проверяют путников и обозы; за воротами начинаются межгородские дороги.`, exits: [
        { to: squareId, distanceM: 420, terrain: "road" }, { to: innId, distanceM: 360, terrain: "street" }
      ] }
    ];
    for (const location of localLocations) world.locations[location.id] = location;

    const merchantId = `${node.id}:merchant`;
    const innkeeperId = `${node.id}:innkeeper`;
    const guardId = `${node.id}:guard`;
    const residents = {
      merchant: localResident(node.countryId, node.kind, `${node.id}:merchant`, "добротная рабочая одежда торговца"),
      innkeeper: localResident(node.countryId, node.kind, `${node.id}:innkeeper`, "фартук поверх простой одежды"),
      guard: localResident(node.countryId, node.kind, `${node.id}:guard`, "стёганка и знак местной стражи")
    };
    const merchant: NpcDef = {
      id: merchantId, name: `${residents.merchant.name} — торговец ${node.name}`, appearance: residents.merchant.appearance,
      homeId: innId, roleTags: ["merchant", "commoner"], originStateId: residents.merchant.originStateId,
      goals: ["Сохранить прибыль лавки", `Найти надёжных поставщиков для ${node.name}`],
      schedule: [{ from: 7, to: 19, locationId: marketId, activity: "торгует и принимает покупателей" }]
    };
    const innkeeper: NpcDef = {
      id: innkeeperId, name: `${residents.innkeeper.name} — хозяин двора ${node.name}`, appearance: residents.innkeeper.appearance,
      homeId: innId, roleTags: ["merchant", "commoner"], originStateId: residents.innkeeper.originStateId,
      goals: ["Удержать постоялый двор прибыльным", "Не допустить драк и неоплаченных счетов"],
      schedule: [{ from: 0, to: 24, locationId: innId, activity: "ведёт постоялый двор" }]
    };
    const guard: NpcDef = {
      id: guardId, name: `${residents.guard.name} — караульный ${node.name}`, appearance: residents.guard.appearance,
      homeId: gateId, roleTags: ["guard", "commoner"], originStateId: residents.guard.originStateId,
      goals: ["Содержать ворота под контролем", "Не пропустить опасных нарушителей"],
      schedule: [{ from: 5, to: 23, locationId: gateId, activity: "несёт караульную службу" }]
    };
    world.npcs[merchant.id] = merchant;
    world.npcs[innkeeper.id] = innkeeper;
    world.npcs[guard.id] = guard;
  }
  return world;
}
