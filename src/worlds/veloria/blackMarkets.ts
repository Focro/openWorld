/** Локальные теневые сети; их ассортимент и доступность ограничены конкретным местом и связями. */
export interface BlackMarket {
  id: string;
  name: string;
  nodeId: string;
  countryId: string;
  visibility: "rumored" | "hidden" | "restricted";
  accessChannels: string[];
  categories: string[];
  prohibitedGoods: string[];
  risks: string[];
  connectedCultIds: string[];
}
export const BLACK_MARKETS: BlackMarket[] = [
  {
    id: "roven-night-ledger",
    name: "Ночной реестр",
    nodeId: "roven",
    countryId: "estran",
    visibility: "rumored",
    accessChannels: ["посредники в Старом квартале", "контакты на речном причале", "долговые записи и рекомендации"],
    categories: ["краденые инструменты", "поддельные пропуска", "запрещённые книги", "редкие лекарственные компоненты"],
    prohibitedGoods: ["контрабандные алхимические реагенты", "краденые храмовые реликвии", "поддельные документы"],
    risks: ["осведомители стражи", "мошенники", "долговая зависимость", "конфликт с гильдиями"],
    connectedCultIds: ["ashen-veil"]
  },
  {
    id: "varent-salt-veil",
    name: "Соляная Завеса",
    nodeId: "varentport",
    countryId: "varent",
    visibility: "hidden",
    accessChannels: ["портовые посредники", "закрытые аукционы", "поддельные грузовые декларации"],
    categories: ["контрабандные артефакты", "редкие алхимические реагенты", "тайные услуги", "нелегальная перевозка"],
    prohibitedGoods: ["запрещённые реагенты", "краденые реликвии", "поддельные документы", "похищенные разумные существа"],
    risks: ["портовые облавы", "конкурирующие торговые дома", "шантаж", "опасный груз"],
    connectedCultIds: ["hollow-cup"]
  },
  {
    id: "miraj-hidden-bazaar",
    name: "Скрытый базар Миража",
    nodeId: "miraj",
    countryId: "sahrad",
    visibility: "restricted",
    accessChannels: ["караванные проводники", "доверенные торговцы", "тайные склады у старой гавани"],
    categories: ["редкие пустынные растения", "запрещённые алхимические смеси", "экзотические животные", "поддельные караванные печати"],
    prohibitedGoods: ["опасные яды", "контрабандные реагенты", "нелегально добытые редкие существа"],
    risks: ["долговая кабала", "пустынные разбойники", "проверки водных советов", "подмена товара"],
    connectedCultIds: ["hollow-cup"]
  },
  {
    id: "azrakar-quiet-archive",
    name: "Тихий архив",
    nodeId: "azrakar",
    countryId: "kharum",
    visibility: "hidden",
    accessChannels: ["писцы-посредники", "закрытые копии реестров", "покровительство чиновника"],
    categories: ["запрещённые трактаты", "поддельные генеалогии", "утраченные алхимические записи", "имперские документы"],
    prohibitedGoods: ["подделки государственных печатей", "украденные архивные оригиналы", "запрещённые трактаты"],
    risks: ["имперское расследование", "подмена архивных копий", "политический шантаж"],
    connectedCultIds: ["ashen-veil", "hollow-cup"]
  }
];
