export const VELORIA_CANON = {
  id: "veloria", version: "0.1.0", name: "Велория",
  subtitle: "Королевство на старой дороге",
  calendar: { currentYearKL: 742, localYearOffset: 742, rule: "yearKL = localYear + localYearOffset" },
  genre: "grounded-medieval-fantasy", era: "late-medieval",
  technology: "craft-and-medieval",
  magic: {
    prevalence: "rare", resurrection: false, matterCreation: false,
    mindReading: false, teleportation: false,
    note: "Редкая магия с ценой; механика ещё не реализована."
  },
  laws: [
    "Расстояние требует времени; мгновенное перемещение запрещено.",
    "Предметы и деньги ограничены; создание из ничего запрещено.",
    "Титул даёт обязанности и влияние, но не абсолютную власть.",
    "NPC знают только наблюдаемое, услышанное или обоснованно выведенное.",
    "Слух не является подтверждённым фактом.",
    "Смерть необратима; воскрешение отсутствует.",
    "ИИ не изменяет канон и состояние мира."
  ],
  geography: {
    continent: "Ардан", kingdom: "Эстран", capital: "Коронхольм", river: "Лир",
    regions: [
      { id: "north-hills", name: "Северные холмы", resources: ["железная руда", "камень", "лес"] },
      { id: "south-valley", name: "Южная долина", resources: ["зерно", "лён", "скот", "виноград"] },
      { id: "west-road", name: "Западный тракт", resources: ["торговля", "перевозки", "пошлины"] }
    ],
    climate: "Умеренный: влажная весна, тёплое лето, дождливая осень, холодная зима."
  },
  politics: {
    monarch: "Королева Элиана III", city: "Ровен", councilSeats: 9,
    councilComposition: { guilds: 4, landowners: 2, royalAdministration: 2, temple: 1 },
    institutions: ["Корона Эстрана", "Городской совет Ровена", "Торговая гильдия", "Храм Семерых", "Городская стража"]
  },
  faith: {
    name: "Храм Семерых",
    role: ["богослужение", "приют", "обучение грамоте", "помощь больным"],
    omniscient: false
  },
  history: [
    { year: -83, yearKL: 659, title: "Основание Ровена", summary: "Поселение выросло у переправы через Лир." },
    { year: -41, yearKL: 701, title: "Городская хартия", summary: "Ровен получил право на рынок и городской совет." },
    { year: -12, yearKL: 730, title: "Война трёх вассалов", summary: "Корона укрепила контроль над западным трактом." },
    { year: -7, yearKL: 735, title: "Восшествие Элианы III", summary: "После смерти короля престол перешёл к его дочери." },
    { year: 0, yearKL: 742, title: "Задержка обозов", summary: "Поставки зерна в Ровен стали приходить с опозданием." }
  ],
  storyFrame: {
    id: "old-road-debt", title: "Долг на старой дороге",
    status: "background-arc-not-yet-implemented",
    premise: "Задержки поставок зерна создают напряжение между торговцами, фермерами и дорожными сборщиками."
  }
} as const;

export type VeloriaOriginId =
  | "minor-heir" | "noble-younger" | "acknowledged-bastard" | "impoverished-noble"
  | "craft-apprentice" | "independent-craftsman" | "merchant-child" | "small-trader"
  | "tenant-farmer" | "free-farmer" | "temple-orphan" | "temple-novice"
  | "former-soldier" | "caravan-hand" | "debt-runaway" | "wanderer";

export const VELORIA_ORIGIN_LABELS: Record<VeloriaOriginId, string> = {
  "minor-heir": "Наследник малого дворянского дома",
  "noble-younger": "Младший ребёнок дворянской семьи",
  "acknowledged-bastard": "Признанный внебрачный ребёнок дворянина",
  "impoverished-noble": "Потомок обедневшего дворянского рода",
  "craft-apprentice": "Ученик ремесленника",
  "independent-craftsman": "Самостоятельный мастер",
  "merchant-child": "Ребёнок торговой семьи",
  "small-trader": "Мелкий торговец",
  "tenant-farmer": "Ребёнок семьи арендаторов",
  "free-farmer": "Свободный земледелец",
  "temple-orphan": "Воспитанник храмового приюта",
  "temple-novice": "Послушник храма",
  "former-soldier": "Бывший солдат",
  "caravan-hand": "Работник каравана",
  "debt-runaway": "Должник, покинувший прежнее место",
  "wanderer": "Странник без подтверждённого происхождения"
};
