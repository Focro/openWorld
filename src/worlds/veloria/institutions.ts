/** Реестр организаций и учреждений, на которые могут ссылаться дворянские дома. */
export interface Institution {
  id: string;
  name: string;
  countryId: string;
  kind: "guild" | "council" | "office" | "military-order" | "trade-association";
  description: string;
  public: boolean;
}
export const INSTITUTIONS: Institution[] = [
  { id: "northwatch-guild", name: "Гильдия Нортвотча", countryId: "estran", kind: "guild", description: "Объединение рудокопов, кузнецов и поставщиков северных рудников.", public: true },
  { id: "varent-notaries", name: "Палата варентских нотариусов", countryId: "varent", kind: "office", description: "Профессиональная палата, удостоверяющая договоры, долги и морские сделки.", public: true },
  { id: "qadira-water-council", name: "Совет колодцев Кадиры", countryId: "sahrad", kind: "council", description: "Орган, распределяющий права на воду и рассматривающий споры о колодцах.", public: true },
  { id: "varent-merchants", name: "Союз варентских купцов", countryId: "varent", kind: "trade-association", description: "Торговое объединение, согласующее караваны, фрахт и кредитные гарантии.", public: true },
  { id: "ironpass-command", name: "Командование Железного Перевала", countryId: "tharvek", kind: "military-order", description: "Пограничная военная структура, отвечающая за заставы и проход через перевал.", public: true },
  { id: "azrakar-bureau", name: "Азракарское архивное управление", countryId: "kharum", kind: "office", description: "Имперское ведомство, ведущее архивы, реестры и копии государственных указов.", public: true }
];
export const institutionById = (id: string): Institution | undefined => INSTITUTIONS.find(x => x.id === id);
