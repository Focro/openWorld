/**
 * Адаптация к движку 0.5+: пути заданы в метрах и типом местности.
 * Расстояния ПОЛУЧЕНЫ из прежних «минут» при пешей скорости 80 м/мин (время пути не изменилось).
 * Это проектные значения, не география из канона; ждут утверждения (см. docs/veloria/AUDIT_INTEGRATION_RU.md).
 */
import type { WorldData } from "../../engine/types";
import { createAppearanceState, lockAppearanceIdentity, type AppearanceIdentity, type AppearanceScar } from "../../engine/appearance";
import { VELORIA_CANON } from "./lore";
import { attachSettlementMaps } from "./settlementMaps";
import { attachResidents } from "./residents";

/** Утверждённые в этой версии исходные профили NPC Ровена. Неизвестные признаки оставлены пустыми. */
function npcAppearance(identity: AppearanceIdentity, hairstyle: string, clothing: string, facialHair?: string, scars: AppearanceScar[] = []) {
  const state = createAppearanceState(identity, { hairstyle, clothing });
  return { ...state, ...(facialHair ? { facialHair } : {}), scars: scars.map(scar => ({ ...scar })) };
}

function npcPersonality(
  temperament: string,
  traits: import("../../engine/types").PersonalityTraits,
  values: string[],
  formativeExperiences: string[],
  copingPatterns: string[],
  initialHabits: Array<{ id: string; label: string; trigger: string; strength: number }>
): import("../../engine/types").NpcPersonality {
  return { temperament, traits, values, formativeExperiences, copingPatterns, initialHabits };
}

export const VELORIA_WORLD: WorldData = {
  name: VELORIA_CANON.name,
  startLocationId: "market-square",
  globalStartId: "roven",
  startYearKL: 742,
  startMoney: 12,
  startInventory: { plain_clothes: 1, bread: 1 },
  items: {
    plain_clothes: { id: "plain_clothes", name: "Простая одежда" },
    bread: { id: "bread", name: "Буханка хлеба" },
    rope: { id: "rope", name: "Пеньковая верёвка" },
    knife: { id: "knife", name: "Рабочий нож" },
    hammer: { id: "hammer", name: "Молоток" },
    bandage: { id: "bandage", name: "Чистая повязка" },
    wool_cloak: { id: "wool_cloak", name: "Шерстяной плащ" }
  },
  locations: {
    "market-square": {
      id: "market-square", name: "Рыночная площадь",
      description: "Шумная площадь Ровена. У колодца спорят возчики, торговцы раскладывают товар.",
      exits: [
        { to: "lower-market", distanceM: 320, terrain: "street" }, { to: "town-hall", distanceM: 480, terrain: "street" },
        { to: "grey-fox", distanceM: 400, terrain: "street" }, { to: "south-gate", distanceM: 960, terrain: "street" },
        { to: "upper-street", distanceM: 560, terrain: "street" }
      ]
    },
    "lower-market": {
      id: "lower-market", name: "Нижний рынок",
      description: "Ряды еды, ткани, инструментов и бытовых товаров.",
      exits: [
        { to: "market-square", distanceM: 320, terrain: "street" }, { to: "smithy", distanceM: 480, terrain: "street" },
        { to: "guild-house", distanceM: 640, terrain: "street" }
      ],
      shop: { keeperId: "marta", prices: { bread: 2, rope: 8, bandage: 5, wool_cloak: 18 } }
    },
    "town-hall": {
      id: "town-hall", name: "Ратуша",
      description: "Каменное здание совета, архива и суда низшей инстанции.",
      exits: [{ to: "market-square", distanceM: 480, terrain: "street" }, { to: "upper-street", distanceM: 400, terrain: "street" }, { to: "temple", distanceM: 720, terrain: "street" }]
    },
    "grey-fox": {
      id: "grey-fox", name: "Таверна «Серая лисица»",
      description: "Постоялый двор с общей комнатой и доской объявлений.",
      exits: [{ to: "market-square", distanceM: 400, terrain: "street" }, { to: "old-quarter", distanceM: 560, terrain: "street" }, { to: "river-dock", distanceM: 720, terrain: "street" }]
    },
    "south-gate": {
      id: "south-gate", name: "Южные ворота",
      description: "Городские ворота, караульная будка и место проверки обозов.",
      exits: [{ to: "market-square", distanceM: 960, terrain: "street" }, { to: "mill-road", distanceM: 1440, terrain: "road" }]
    },
    "upper-street": {
      id: "upper-street", name: "Верхняя улица",
      description: "Просторная улица с домами состоятельных горожан и нотариальной конторой.",
      exits: [{ to: "market-square", distanceM: 560, terrain: "street" }, { to: "town-hall", distanceM: 400, terrain: "street" }, { to: "guild-house", distanceM: 480, terrain: "street" }]
    },
    "smithy": {
      id: "smithy", name: "Кузница Орна",
      description: "Жаркий двор с горном, наковальней и стойками для инструментов.",
      exits: [{ to: "lower-market", distanceM: 480, terrain: "street" }],
      shop: { keeperId: "orn", prices: { hammer: 14, knife: 9 } }
    },
    "temple": {
      id: "temple", name: "Храм Семерых",
      description: "Храм с приютом, лечебной комнатой и школой грамоты.",
      exits: [{ to: "town-hall", distanceM: 720, terrain: "street" }]
    },
    "river-dock": {
      id: "river-dock", name: "Речной причал",
      description: "Причал и склады у реки Лир; здесь нанимают грузчиков и лодочников.",
      exits: [{ to: "grey-fox", distanceM: 720, terrain: "street" }, { to: "old-quarter", distanceM: 640, terrain: "street" }]
    },
    "old-quarter": {
      id: "old-quarter", name: "Старый квартал",
      description: "Тесные переулки, дешёвые комнаты, мастерские и общие дворы.",
      exits: [{ to: "grey-fox", distanceM: 560, terrain: "street" }, { to: "river-dock", distanceM: 640, terrain: "street" }]
    },
    "guild-house": {
      id: "guild-house", name: "Дом торговой гильдии",
      description: "Контора договоров, долговых книг и торговых споров.",
      exits: [{ to: "lower-market", distanceM: 640, terrain: "street" }, { to: "upper-street", distanceM: 480, terrain: "street" }]
    },
    "mill-road": {
      id: "mill-road", name: "Дорога к мельницам",
      description: "Укатанная дорога вдоль полей к мельницам и сельским дворам.",
      exits: [{ to: "south-gate", distanceM: 1440, terrain: "road" }]
    }
  },
  npcs: {
    marta: {
      id: "marta", name: "Марта Вейл", homeId: "grey-fox", roleTags: ["merchant", "commoner"],
      appearance: npcAppearance({ naturalHairColor: "тёмно-каштановые", hairTexture: "волнистые", eyeColor: "серо-зелёные", facialFeatures: "мягкие" }, "волосы собраны в тугой узел", "тёмный передник поверх простой рубахи"),
      goals: ["Накопить на собственную пекарню", "Сохранить доступ к муке по приемлемой цене"],
      personality: npcPersonality("тёплая, практичная и деятельная", { warmth: 76, sociability: 78, assertiveness: 58, emotionalReactivity: 52, patience: 66, openness: 61, discipline: 72, suspicion: 48, empathy: 70, pride: 55 }, ["самостоятельность", "честный труд", "надёжность"], ["Ранний опыт торговли научил её считать расходы и полагаться на собственный труд."], ["при тревоге переключается на конкретную работу", "сначала пытается договориться, но умеет твёрдо защищать своё дело"], [{ id: "market-routine", label: "проверяет товар и цены до начала торговли", trigger: "утренняя торговля", strength: 72 }, { id: "saves-for-bakery", label: "откладывает часть выручки", trigger: "получение дохода", strength: 65 }]),
      schedule: [
        { from: 6, to: 17, locationId: "lower-market", activity: "торгует едой и припасами" },
        { from: 17, to: 21, locationId: "grey-fox", activity: "помогает в таверне" }
      ]
    },
    orn: {
      id: "orn", name: "Орн Келлер", homeId: "old-quarter", roleTags: ["commoner"],
      appearance: npcAppearance({ naturalHairColor: "тёмно-русые", hairTexture: "прямые", eyeColor: "карие", facialFeatures: "широкие" }, "коротко остриженные волосы", "кожаный фартук и льняная рубаха", "короткая борода"),
      goals: ["Удержать кузницу на плаву", "Найти надёжного ученика"],
      personality: npcPersonality("молчаливый, основательный и упрямый", { warmth: 43, sociability: 31, assertiveness: 68, emotionalReactivity: 38, patience: 77, openness: 39, discipline: 84, suspicion: 57, empathy: 52, pride: 66 }, ["мастерство", "честность", "верность слову"], ["Многолетняя работа у горна приучила его ценить точность и результат больше красивых обещаний."], ["при стрессе замыкается и продолжает работу", "доверяет поступкам больше, чем словам"], [{ id: "tool-check", label: "проверяет инструменты перед работой", trigger: "начало смены", strength: 82 }, { id: "craft-focus", label: "не любит, когда его отвлекают во время работы", trigger: "работа у горна", strength: 58 }]),
      schedule: [
        { from: 7, to: 18, locationId: "smithy", activity: "работает у горна" },
        { from: 18, to: 21, locationId: "grey-fox", activity: "ужинает с возчиками" }
      ]
    },
    sergeant: {
      id: "sergeant", name: "Сержант Бран", homeId: "south-gate", roleTags: ["guard", "commoner"],
      appearance: npcAppearance({ naturalHairColor: "чёрные с проседью", hairTexture: "прямые", eyeColor: "серые", facialFeatures: "угловатые" }, "короткая военная стрижка", "потёртая форма городской стражи", undefined, [{ id: "bran-old-scar", description: "тонкий старый рубец", location: "у левого виска", formedAt: 0, permanent: true }]),
      goals: ["Не допустить контрабанды", "Получить повышение до капитана"],
      personality: npcPersonality("строгий, дисциплинированный и настороженный", { warmth: 39, sociability: 42, assertiveness: 82, emotionalReactivity: 45, patience: 61, openness: 35, discipline: 91, suspicion: 78, empathy: 48, pride: 70 }, ["порядок", "ответственность", "репутация службы"], ["Служба и ответственность за город сформировали привычку проверять детали и не полагаться на первое впечатление."], ["при угрозе сначала устанавливает контроль", "личные чувства старается не показывать при подчинённых"], [{ id: "gate-inspection", label: "повторно проверяет подозрительные обозы", trigger: "сомнение в безопасности", strength: 76 }, { id: "report-routine", label: "сверяет события с рапортами", trigger: "окончание дежурства", strength: 62 }]),
      schedule: [
        { from: 5, to: 13, locationId: "south-gate", activity: "проверяет обозы" },
        { from: 13, to: 17, locationId: "town-hall", activity: "сдаёт рапорт" },
        { from: 17, to: 22, locationId: "south-gate", activity: "командует караулом" }
      ]
    },
    sister_alen: {
      id: "sister_alen", name: "Сестра Ален", homeId: "temple", roleTags: ["clergy", "healer"],
      appearance: npcAppearance({ naturalHairColor: "медно-каштановые", hairTexture: "волнистые", eyeColor: "карие", facialFeatures: "узкие" }, "волосы убраны под простой головной платок", "тёмное храмовое платье и светлый передник"),
      goals: ["Обеспечить приют лекарствами", "Научить детей читать"],
      personality: npcPersonality("сочувственная, терпеливая и внутренне стойкая", { warmth: 84, sociability: 57, assertiveness: 52, emotionalReactivity: 48, patience: 88, openness: 66, discipline: 79, suspicion: 37, empathy: 92, pride: 42 }, ["милосердие", "образование", "достоинство каждого человека"], ["Забота о больных и детях укрепила её терпение и умение сохранять спокойствие в тяжёлых обстоятельствах."], ["сначала выслушивает, затем предлагает помощь", "при угрозе слабым становится решительной", "не считает сострадание обязанностью терпеть жестокость"], [{ id: "morning-care", label: "проверяет запасы лекарств и нужды приюта", trigger: "начало дня", strength: 78 }, { id: "listening", label: "даёт собеседнику закончить мысль", trigger: "личный разговор", strength: 70 }]),
      schedule: [
        { from: 6, to: 12, locationId: "temple", activity: "помогает больным" },
        { from: 12, to: 16, locationId: "temple", activity: "обучает грамоте" },
        { from: 16, to: 19, locationId: "market-square", activity: "собирает пожертвования" }
      ]
    },
    elric: {
      id: "elric", name: "Элрик Данн", homeId: "grey-fox", roleTags: ["merchant", "commoner"],
      appearance: npcAppearance({ naturalHairColor: "каштановые", hairTexture: "волнистые", eyeColor: "ореховые", facialFeatures: "узкие" }, "волосы средней длины, зачёсаны назад", "дорожный плащ поверх тёмного жилета", "аккуратно подстриженная борода"),
      goals: ["Найти пропавший обоз", "Защитить семью от обвинений гильдии"],
      personality: npcPersonality("наблюдательный, осторожный и обаятельный, когда это выгодно", { warmth: 52, sociability: 68, assertiveness: 57, emotionalReactivity: 58, patience: 64, openness: 54, discipline: 67, suspicion: 72, empathy: 47, pride: 61 }, ["семья", "самосохранение", "справедливость к своим"], ["Исчезновение обоза и обвинения гильдии сделали его внимательным к несостыковкам и чужим мотивам."], ["сначала собирает сведения, потом действует", "в напряжённом разговоре может скрывать настоящую тревогу за вежливостью", "семейную угрозу воспринимает особенно остро"], [{ id: "information-gathering", label: "задаёт уточняющие вопросы и сопоставляет версии", trigger: "неясное событие", strength: 73 }, { id: "evening-informants", label: "обменивается новостями с надёжными знакомыми", trigger: "вечерняя встреча", strength: 61 }]),
      schedule: [
        { from: 7, to: 11, locationId: "guild-house", activity: "проверяет торговые записи" },
        { from: 11, to: 16, locationId: "river-dock", activity: "расспрашивает лодочников" },
        { from: 18, to: 23, locationId: "grey-fox", activity: "встречается с информаторами" }
      ]
    }
  }
};

export function createVeloriaWorld(): WorldData {
  const world = attachResidents(attachSettlementMaps(structuredClone(VELORIA_WORLD)));
  for (const npc of Object.values(world.npcs)) {
    if (npc.appearance) npc.appearance = lockAppearanceIdentity(npc.appearance);
  }
  return world;
}
