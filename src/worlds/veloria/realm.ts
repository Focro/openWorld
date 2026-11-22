/**
 * Стартовая книга держав Велории. Канон даёт только правителей, устройство, экспорт и напряжения (atlas.ts).
 * Все числа, выгоды торговли, обиды и фракции ниже проектные (proposal), в Библии мира их нет.
 */
import type { RealmDefinition } from "../../engine/realm";
import { COUNTRIES } from "./atlas";

const ruler = (id: string) => COUNTRIES.find(c => c.id === id)!.ruler;
const name = (id: string) => COUNTRIES.find(c => c.id === id)!.name;

export const VELORIA_REALM: RealmDefinition = {
  powers: [
    { id: "estran", name: name("estran"), ruler: ruler("estran"), incomePerDay: 1.6, harvestPerDay: 6, grainUsePerDay: 5.4, start: { treasury: 300, grain: 600, troops: 20, stability: 60, duty: 0.05 }, neighbors: ["elyndor", "sahrad", "tharvek", "varent"] },
    { id: "sahrad", name: name("sahrad"), ruler: ruler("sahrad"), incomePerDay: 1.5, harvestPerDay: 3, grainUsePerDay: 3.3, start: { treasury: 280, grain: 250, troops: 18, stability: 45, duty: 0.08 }, neighbors: ["estran", "tharvek", "kharum"] },
    { id: "varent", name: name("varent"), ruler: ruler("varent"), incomePerDay: 2.5, harvestPerDay: 1.5, grainUsePerDay: 2.2, start: { treasury: 600, grain: 200, troops: 8, stability: 65, duty: 0.04 }, neighbors: ["estran", "tharvek"] },
    { id: "tharvek", name: name("tharvek"), ruler: ruler("tharvek"), incomePerDay: 1.2, harvestPerDay: 1.8, grainUsePerDay: 2, start: { treasury: 200, grain: 220, troops: 22, stability: 50, duty: 0.1 }, neighbors: ["estran", "sahrad", "varent", "kharum"] },
    { id: "elyndor", name: name("elyndor"), ruler: ruler("elyndor"), incomePerDay: 1, harvestPerDay: 2.5, grainUsePerDay: 2.3, start: { treasury: 180, grain: 300, troops: 8, stability: 62, duty: 0.03 }, neighbors: ["estran"] },
    { id: "kharum", name: name("kharum"), ruler: ruler("kharum"), incomePerDay: 2.4, harvestPerDay: 7, grainUsePerDay: 6.6, start: { treasury: 700, grain: 900, troops: 30, stability: 48, duty: 0.06 }, neighbors: ["sahrad", "tharvek"] }
  ],
  factions: [
    { id: "estran:vassals", powerId: "estran", name: "Крупные вассалы", strength: 35, aim: "throne" },
    { id: "sahrad:succession", powerId: "sahrad", name: "Партия спорного наследника", strength: 40, aim: "throne" },
    { id: "varent:houses", powerId: "varent", name: "Соперничающие торговые дома", strength: 30, aim: "trade" },
    { id: "tharvek:old-houses", powerId: "tharvek", name: "Старые роды", strength: 30, aim: "throne" },
    { id: "elyndor:loggers", powerId: "elyndor", name: "Пришлые лесорубы", strength: 15, aim: "trade" },
    { id: "kharum:court", powerId: "kharum", name: "Придворная партия", strength: 40, aim: "throne" }
  ],
  tradeBenefit: {
    "estran|varent": 30, "kharum|varent": 30, "sahrad|varent": 20, "elyndor|varent": 20, "estran|sahrad": 20,
    "estran|elyndor": 15, "tharvek|varent": 15, "estran|tharvek": 10, "estran|kharum": 10, "kharum|sahrad": 10,
    "kharum|tharvek": 5, "elyndor|kharum": 5, "elyndor|sahrad": 5, "elyndor|tharvek": 5, "sahrad|tharvek": 5
  },
  // По напряжениям атласа: закрытие перевалов Тарвеком задевает Эстран.
  grudges: [{ from: "estran", against: "tharvek", weight: 15 }, { from: "tharvek", against: "estran", weight: 5 }]
};
