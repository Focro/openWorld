/**
 * «Новая жизнь в Велории» (0.16.0): кем родиться.
 *
 * Каталог происхождений по всем шести державам. В карточке только то, кем ребёнок является
 * при рождении: ни одной подсказки о будущем. Семья под каждое происхождение собирается
 * генератором (birthFamily.ts) из устойчивого seed. Это сгенерированные люди, не канон:
 * никто из них не входит в родословные великих домов. Единственное каноническое происхождение
 * в списке: второй принц дома Рейнар (fixed), он собирается отдельным сценарием.
 */
import type { VeloriaOriginId, VeloriaStatusId } from "./character";
import type { StateId } from "./populations";

export type BirthGroup = "земля" | "ремесло" | "торговля" | "служба" | "храм" | "дно" | "малый дом" | "королевский дом";
export const BIRTH_GROUPS: BirthGroup[] = ["земля", "ремесло", "торговля", "служба", "храм", "дно", "малый дом", "королевский дом"];
export type WealthHint = "бедно" | "скромно" | "в достатке";

/** Где проходит день взрослого: дома, на своей работе или в общих местах поселения. */
export type WorkPlace = "home" | "work" | "square" | "market" | "inn" | "gate" | (string & {});
export interface PlaceSpec { name: string; description: string }
export interface DutySpec { activity: string; at: WorkPlace }

export interface BirthOrigin {
  id: string;
  stateId: StateId;
  settlementId: string;
  group: BirthGroup;
  label: string;
  /** До 70 знаков: карточка на телефоне. */
  blurb: string;
  wealthHint: WealthHint;
  /** Внутренний флаг: семья, год и внешность заданы каноном. В интерфейсе никак не выделяется. */
  fixed?: true;
  legacyOriginId: VeloriaOriginId;
  statusId: VeloriaStatusId;
  home: PlaceSpec & { near?: WorkPlace };
  work?: PlaceSpec;
  father: DutySpec;
  mother: DutySpec;
  /** Подкидыш: растят служители веры, родители неизвестны. */
  foundling?: { guardianTitle: string; guardianRole: string; clothing: string; institutionId: string };
  /** Дом держит прислугу: няня и управляющий. */
  servants?: true;
  values: string[];
}

export interface BirthState { id: StateId; name: string; blurb: string; climate: string; knownFor: string }
export const BIRTH_STATES: BirthState[] = [
  { id: "estran", name: "Эстран", climate: "Умеренный: тёплое лето, снежная зима", knownFor: "Зерно, лён и железо. Корона, гильдии и старые торговые дороги.", blurb: "Королевство полей, старых дорог и гильдий." },
  { id: "sahrad", name: "Сахрад", climate: "Жаркий и сухой: пустыни и оазисы", knownFor: "Соль, стекло, финики и пряности. Власть держится на воде и караванах.", blurb: "Пустыни и оазисы, где власть держится на воде." },
  { id: "tharvek", name: "Тарвек", climate: "Горный и холодный, перевалы закрываются зимой", knownFor: "Железо, олово и оружие. Заставы, рудники и клятвы родов.", blurb: "Горы, заставы, рудники и клятвы родов." },
  { id: "varent", name: "Варент", climate: "Умеренный морской: ветра и туманы", knownFor: "Корабли, книги, краски и банки. Всё решают договор и капитал.", blurb: "Морские города, где всё решают договор и капитал." },
  { id: "elyndor", name: "Элиндор", climate: "Холодный: леса, озёра, долгая зима", knownFor: "Древесина, травы, смолы и меха. Советы родов и священные рощи.", blurb: "Северные леса и озёра, советы родов." },
  { id: "kharum", name: "Кхарум", climate: "Жаркий и влажный: дельты и сезон дождей", knownFor: "Рис, хлопок, сахар и керамика. Каналы, реестры и чиновничьи экзамены.", blurb: "Империя дельт, каналов и чиновничьих экзаменов." }
];

const own = (name: string, description: string): PlaceSpec => ({ name, description });
const home = (name: string, description: string, near?: WorkPlace) => ({ name, description, near });

export const SECOND_PRINCE_ORIGIN_ID = "estran-second-prince";

export const BIRTH_ORIGINS: BirthOrigin[] = [
  // Эстран
  { id: "estran-tenant", stateId: "estran", settlementId: "roven", group: "земля", label: "Семья арендаторов", blurb: "Пашете чужую землю у мельничной дороги, встаёте до рассвета.", wealthHint: "бедно",
    legacyOriginId: "tenant-farmer", statusId: "rural-free", home: home("Хижина арендаторов", "Низкий дом с соломенной крышей у мельничной дороги. Очаг, лавки, запах дыма и сырой земли.", "mill-road"),
    father: { activity: "работает в поле и на мельнице", at: "mill-road" }, mother: { activity: "ведёт хозяйство, огород и птицу", at: "home" }, values: ["семья", "хлеб на столе", "не злить хозяина земли"] },
  { id: "estran-free-farmer", stateId: "estran", settlementId: "westmere", group: "земля", label: "Семья свободных земледельцев", blurb: "Своё поле у переправы Вестмера, свой хлеб и свои долги.", wealthHint: "скромно",
    legacyOriginId: "free-farmer", statusId: "rural-free", home: home("Дом на краю поля", "Крепкий дом с амбаром у переправы. Свой надел за плетнём, своя корова в хлеву."),
    work: own("Поле у переправы", "Надел семьи между дорогой и рекой. Межевые камни, борозды, ветер с воды."),
    father: { activity: "работает на своём поле", at: "work" }, mother: { activity: "ведёт хозяйство и возит зерно к амбарам", at: "home" }, values: ["своя земля", "честный труд", "соседская выручка"] },
  { id: "estran-lumber", stateId: "estran", settlementId: "ashcombe", group: "земля", label: "Семья лесорубов", blurb: "Лесопилка Эшкомба, смолистый дым и топоры с рассвета.", wealthHint: "бедно",
    legacyOriginId: "tenant-farmer", statusId: "rural-free", home: home("Изба у лесопилки", "Бревенчатый дом, пахнущий смолой. За стеной визжит пила, у порога поленница."),
    work: own("Лесопилка Эшкомба", "Навес, пилы, штабеля досок и вечная стружка под ногами."),
    father: { activity: "валит лес и работает на лесопилке", at: "work" }, mother: { activity: "ведёт хозяйство и собирает хворост", at: "home" }, values: ["сила рук", "семья", "не болтать лишнего"] },
  { id: "estran-smith", stateId: "estran", settlementId: "roven", group: "ремесло", label: "Семья кузнеца", blurb: "Жар горна и звон молота с первых дней.", wealthHint: "скромно",
    legacyOriginId: "craft-apprentice", statusId: "guild-free", home: home("Дом за кузницей", "Дом в Старом квартале, стена к стене с кузницей. Всегда тепло и всегда шумно.", "old-quarter"),
    father: { activity: "работает в кузнице", at: "smithy" }, mother: { activity: "ведёт хозяйство и счёт заказам", at: "home" }, values: ["ремесло", "гильдейская честь", "семья"] },
  { id: "estran-miller", stateId: "estran", settlementId: "millford", group: "ремесло", label: "Семья мельника", blurb: "Жернова Миллфорда, мука в волосах и шум воды.", wealthHint: "в достатке",
    legacyOriginId: "independent-craftsman", statusId: "guild-free", home: home("Дом мельника", "Добротный дом у мельничного пруда. Мешки в сенях, белая пыль на подоконниках."),
    work: own("Мельница", "Водяное колесо, скрип жерновов, очередь телег с зерном."),
    father: { activity: "работает на мельнице", at: "work" }, mother: { activity: "ведёт хозяйство и записи помола", at: "home" }, values: ["достаток", "доброе имя", "порядок"] },
  { id: "estran-trader", stateId: "estran", settlementId: "roven", group: "торговля", label: "Семья мелкого торговца", blurb: "Лоток на нижнем рынке, все соседи знакомы.", wealthHint: "скромно",
    legacyOriginId: "small-trader", statusId: "guild-free", home: home("Комнаты над лавкой", "Две тесные комнаты над лавкой у нижнего рынка. Внизу ящики, наверху вся семья.", "lower-market"),
    father: { activity: "торгует на нижнем рынке", at: "lower-market" }, mother: { activity: "держит лавку и ведёт хозяйство", at: "home" }, values: ["выгода", "связи", "семья"] },
  { id: "estran-carters", stateId: "estran", settlementId: "roven", group: "торговля", label: "Семья возчиков", blurb: "Обозы и пристань на Лире, дом там, где стоянка.", wealthHint: "бедно",
    legacyOriginId: "caravan-hand", statusId: "serving", home: home("Каморка у пристани", "Пристройка у речных складов. Сквозняк, запах реки и конского пота.", "river-dock"),
    father: { activity: "грузит обозы у пристани", at: "river-dock" }, mother: { activity: "стирает на реке и ведёт хозяйство", at: "home" }, values: ["дорога", "своё слово", "семья"] },
  { id: "estran-stablehand", stateId: "estran", settlementId: "roven", group: "служба", label: "Ребёнок конюха", blurb: "Конюшня при «Серой лисе»: лошади, путники, сплетни.", wealthHint: "бедно",
    legacyOriginId: "caravan-hand", statusId: "serving", home: home("Комната над конюшней", "Тесная комната над стойлами постоялого двора. Тепло от лошадей, сено в щелях пола.", "grey-fox"),
    father: { activity: "ухаживает за лошадьми постояльцев", at: "grey-fox" }, mother: { activity: "работает на кухне постоялого двора", at: "grey-fox" }, values: ["работа", "не попадаться хозяину", "семья"] },
  { id: "estran-servants", stateId: "estran", settlementId: "roven", group: "служба", label: "Ребёнок прислуги", blurb: "Мать служит в богатом доме на Верхней улице.", wealthHint: "скромно",
    legacyOriginId: "small-trader", statusId: "serving", home: home("Каморка при людской", "Каморка в людской богатого дома. Чисто, тихо и всегда чужое.", "upper-street"),
    father: { activity: "работает истопником и посыльным", at: "upper-street" }, mother: { activity: "служит горничной в богатом доме", at: "upper-street" }, values: ["место в доме", "осторожность", "семья"] },
  { id: "estran-garrison", stateId: "estran", settlementId: "northwatch", group: "служба", label: "Семья солдата", blurb: "Гарнизон Нортвотча: холод, рудники, сигнальные рога.", wealthHint: "скромно",
    legacyOriginId: "former-soldier", statusId: "serving", home: home("Дом в гарнизонном посаде", "Казённый дом у крепостной стены. Печь, сундук, плащ на гвозде.", "gate"),
    father: { activity: "несёт службу в гарнизоне", at: "gate" }, mother: { activity: "чинит и шьёт для гарнизона, ведёт хозяйство", at: "home" }, values: ["долг", "дисциплина", "своих не бросают"] },
  { id: "estran-foundling", stateId: "estran", settlementId: "roven", group: "храм", label: "Подкидыш у храма Семерых", blurb: "Тебя оставили на ступенях храма. Кто родители, неизвестно.", wealthHint: "бедно",
    legacyOriginId: "temple-orphan", statusId: "temple", home: { name: "Приют при храме", description: "" }, father: { activity: "", at: "home" }, mother: { activity: "", at: "home" },
    foundling: { guardianTitle: "Сестра", guardianRole: "храмовая сестра", clothing: "серое платье храмовой сестры", institutionId: "institution:sevenfold-temple" }, values: ["милосердие", "порядок", "вера"] },
  { id: "estran-old-quarter", stateId: "estran", settlementId: "roven", group: "дно", label: "Ребёнок Старого квартала", blurb: "Тесные дворы, долги и соседи, которые всё видят.", wealthHint: "бедно",
    legacyOriginId: "debt-runaway", statusId: "marginal", home: home("Угол в доходном доме", "Угол в сыром доме Старого квартала. За стенкой ругаются, во дворе пахнет помоями.", "old-quarter"),
    father: { activity: "ищет подённую работу", at: "lower-market" }, mother: { activity: "стирает чужое бельё и ведёт хозяйство", at: "home" }, values: ["выжить", "не задолжать", "свои рядом"] },
  { id: "estran-gentry", stateId: "estran", settlementId: "millford", group: "малый дом", label: "Малый дворянский род", blurb: "Старое имя, небольшое поместье и много обязательств.", wealthHint: "в достатке",
    legacyOriginId: "impoverished-noble", statusId: "noble", servants: true, home: home("Усадьба рода", "Каменная усадьба на холме у Миллфорда. Старый герб над дверью, скрипучие полы, слуги."),
    father: { activity: "объезжает земли и разбирает дела арендаторов", at: "square" }, mother: { activity: "ведёт дом и переписку рода", at: "home" }, values: ["честь рода", "долг перед короной", "приличия"] },
  { id: SECOND_PRINCE_ORIGIN_ID, stateId: "estran", settlementId: "koronholm", group: "королевский дом", label: "Второй принц дома Рейнар", blurb: "Рождение при дворе Коронхольма, 723 КЛ.", wealthHint: "в достатке", fixed: true,
    legacyOriginId: "acknowledged-bastard", statusId: "noble", home: { name: "Королевская детская", description: "" }, father: { activity: "", at: "home" }, mother: { activity: "", at: "home" }, values: [] },

  // Сахрад
  { id: "sahrad-date-gardeners", stateId: "sahrad", settlementId: "daryat", group: "земля", label: "Семья садовников финиковых рощ", blurb: "Каналы Дарьята и тень пальм, вода по очереди.", wealthHint: "бедно",
    legacyOriginId: "tenant-farmer", statusId: "rural-free", home: home("Глинобитный дом у канала", "Дом из сырцового кирпича у оросительного канала. Плоская крыша, кувшины с водой в тени."),
    work: own("Финиковая роща", "Ряды пальм над узкими каналами. Воду пускают по очереди, и каждый час на счету."),
    father: { activity: "ухаживает за пальмами и каналами", at: "work" }, mother: { activity: "ведёт хозяйство и сушит финики", at: "home" }, values: ["вода", "община", "терпение"] },
  { id: "sahrad-fishers", stateId: "sahrad", settlementId: "miraj", group: "земля", label: "Семья рыбаков Миража", blurb: "Лодки, сети и медная пыль портового ветра.", wealthHint: "бедно",
    legacyOriginId: "caravan-hand", statusId: "serving", home: home("Лачуга у лодочного берега", "Дом из камня и плавника у берега. Сети сушатся на кольях, пахнет солью и рыбой.", "gate"),
    father: { activity: "уходит в море с артелью", at: "gate" }, mother: { activity: "чинит сети и продаёт улов", at: "market" }, values: ["артель", "море кормит и забирает", "семья"] },
  { id: "sahrad-glass", stateId: "sahrad", settlementId: "qadira", group: "ремесло", label: "Семья стеклодува", blurb: "Печи Кадиры, жар и тонкое стекло на продажу.", wealthHint: "скромно",
    legacyOriginId: "craft-apprentice", statusId: "guild-free", home: home("Дом стеклодувов", "Дом во дворе мастерских. Звон стекла, жар печей и песок под ногами."),
    work: own("Стеклодувная мастерская", "Печи, трубки, остывающие сосуды на полках. Жара даже ночью."),
    father: { activity: "выдувает стекло в мастерской", at: "work" }, mother: { activity: "расписывает стекло и ведёт хозяйство", at: "home" }, values: ["мастерство", "честь цеха", "семья"] },
  { id: "sahrad-dyers", stateId: "sahrad", settlementId: "saffron-coast", group: "ремесло", label: "Семья красильщиков", blurb: "Чаны с шафраном, руки в краске до локтей.", wealthHint: "бедно",
    legacyOriginId: "craft-apprentice", statusId: "guild-free", home: home("Дом у красилен", "Дом у красильных чанов. Ткани сушатся на крыше, всё вокруг в жёлтых пятнах."),
    work: own("Красильни", "Чаны с шафраном и мареной, едкий пар и цветные лужи."),
    father: { activity: "работает у красильных чанов", at: "work" }, mother: { activity: "красит ткани и ведёт хозяйство", at: "work" }, values: ["ремесло", "заработок", "семья"] },
  { id: "sahrad-bazaar", stateId: "sahrad", settlementId: "qadira", group: "торговля", label: "Семья лавочника с базара", blurb: "Крытый базар Кадиры, торг с утра до темноты.", wealthHint: "скромно",
    legacyOriginId: "small-trader", statusId: "guild-free", home: home("Дом за лавкой", "Дом за лавкой на крытом базаре. Ковры, мешки пряностей и вечный гул голосов.", "market"),
    father: { activity: "торгует пряностями на базаре", at: "market" }, mother: { activity: "ведёт хозяйство и счёт лавки", at: "home" }, values: ["выгода", "гостеприимство", "семья"] },
  { id: "sahrad-caravan", stateId: "sahrad", settlementId: "safra", group: "торговля", label: "Семья погонщиков верблюдов", blurb: "Караван-сарай Сафры, колодец и вечные проводы.", wealthHint: "бедно",
    legacyOriginId: "caravan-hand", statusId: "serving", home: home("Комната в караван-сарае", "Комната во внешнем кольце караван-сарая. Верблюды под окном, песок в одеялах.", "inn"),
    father: { activity: "водит караваны и чинит сбрую", at: "inn" }, mother: { activity: "носит воду и готовит для каравана", at: "inn" }, values: ["караванный договор", "вода", "семья"] },
  { id: "sahrad-palace-servants", stateId: "sahrad", settlementId: "qadira", group: "служба", label: "Ребёнок дворцовой прислуги", blurb: "Мать служит в доме наместника в Кадире.", wealthHint: "скромно",
    legacyOriginId: "small-trader", statusId: "serving", home: home("Комната в квартале слуг", "Белёная комната в квартале прислуги. Чисто, тесно, за стеной сад наместника.", "square"),
    father: { activity: "служит водоносом при доме наместника", at: "square" }, mother: { activity: "служит в покоях дома наместника", at: "square" }, values: ["место при доме", "осторожность", "семья"] },
  { id: "sahrad-foundling", stateId: "sahrad", settlementId: "qadira", group: "храм", label: "Найдёныш у храмового колодца", blurb: "Тебя нашли у храмового колодца. Родных никто не знает.", wealthHint: "бедно",
    legacyOriginId: "temple-orphan", statusId: "temple", home: { name: "Приют Пути Колодцев", description: "Дом при храмовом колодце Кадиры. Прохладные стены, плеск воды, детские голоса." }, father: { activity: "", at: "home" }, mother: { activity: "", at: "home" },
    foundling: { guardianTitle: "Хранительница", guardianRole: "хранительница колодца", clothing: "синее покрывало служительницы колодца", institutionId: "institution:path-of-wells" }, values: ["вода общая", "милосердие", "вера"] },
  { id: "sahrad-port-slums", stateId: "sahrad", settlementId: "miraj", group: "дно", label: "Ребёнок портовых трущоб", blurb: "Узкие улицы у порта Миража, выживает хитрый.", wealthHint: "бедно",
    legacyOriginId: "debt-runaway", statusId: "marginal", home: home("Навес в портовых трущобах", "Пристройка из досок и тряпья в переулке у порта. Мухи, крики, чужие правила.", "gate"),
    father: { activity: "ищет подённую работу в порту", at: "gate" }, mother: { activity: "продаёт лепёшки у причала", at: "market" }, values: ["выжить", "не верить чужим", "свои рядом"] },
  { id: "sahrad-water-lords", stateId: "sahrad", settlementId: "daryat", group: "малый дом", label: "Род владельцев канала", blurb: "Твой род держит долю воды в каналах Дарьята.", wealthHint: "в достатке",
    legacyOriginId: "impoverished-noble", statusId: "noble", servants: true, home: home("Дом с внутренним двором", "Дом с фонтаном во внутреннем дворе. Ковры, прохлада, слуги и гости по делам воды."),
    father: { activity: "разбирает споры о воде и принимает просителей", at: "square" }, mother: { activity: "ведёт дом и связи рода", at: "home" }, values: ["честь рода", "вода как власть", "гостеприимство"] },

  // Тарвек
  { id: "tharvek-herders", stateId: "tharvek", settlementId: "stonebridge", group: "земля", label: "Семья горных пастухов", blurb: "Козы на склонах, мост через ущелье и ветер.", wealthHint: "бедно",
    legacyOriginId: "free-farmer", statusId: "rural-free", home: home("Каменный дом на склоне", "Дом из плитняка над ущельем. Узкие окна, очаг посредине, козы за стеной."),
    work: own("Горные пастбища", "Склоны над Каменным Мостом, тропы для коз и ветер, который не стихает."),
    father: { activity: "пасёт коз на склонах", at: "work" }, mother: { activity: "делает сыр и ведёт хозяйство", at: "home" }, values: ["род", "выносливость", "своё слово"] },
  { id: "tharvek-miners", stateId: "tharvek", settlementId: "deepforge", group: "ремесло", label: "Семья рудокопа", blurb: "Шахты Глубокой Кузни: темнота, кашель и плата медью.", wealthHint: "бедно",
    legacyOriginId: "craft-apprentice", statusId: "serving", home: home("Дом в шахтёрской слободе", "Тёмный дом в слободе у шахт. На всём серая пыль, у двери кирки и лампа."),
    work: own("Рудник", "Вход в штольню, вагонетки, сырость и гул под землёй."),
    father: { activity: "работает в шахте", at: "work" }, mother: { activity: "сортирует руду и ведёт хозяйство", at: "home" }, values: ["артель", "терпение", "семья"] },
  { id: "tharvek-armorers", stateId: "tharvek", settlementId: "dravorn", group: "ремесло", label: "Семья оружейника", blurb: "Кузни Драворна, где куют клинки для застав.", wealthHint: "скромно",
    legacyOriginId: "independent-craftsman", statusId: "guild-free", home: home("Дом оружейника", "Каменный дом в квартале кузниц. Стены дрожат от молотов, пахнет окалиной."),
    work: own("Оружейная кузня", "Горн, наковальни, клинки на стойках и заказы застав."),
    father: { activity: "куёт оружие в кузне", at: "work" }, mother: { activity: "ведёт счёт заказам и хозяйство", at: "home" }, values: ["мастерство", "клятва", "семья"] },
  { id: "tharvek-innkeepers", stateId: "tharvek", settlementId: "stonebridge", group: "торговля", label: "Семья хозяев постоялого двора", blurb: "Двор у моста: путники, пиво и чужие истории.", wealthHint: "скромно",
    legacyOriginId: "small-trader", statusId: "guild-free", home: home("Комнаты при дворе", "Жилые комнаты за общим залом постоялого двора. Шум до полуночи.", "inn"),
    father: { activity: "помогает вести постоялый двор", at: "inn" }, mother: { activity: "готовит для постояльцев", at: "inn" }, values: ["гостеприимство", "выгода", "семья"] },
  { id: "tharvek-pass-guard", stateId: "tharvek", settlementId: "ironpass", group: "служба", label: "Семья заставного воина", blurb: "Застава на перевале, служба по клятве рода.", wealthHint: "скромно",
    legacyOriginId: "former-soldier", statusId: "serving", home: home("Дом под заставой", "Дом в посаде под стенами заставы. Холодно, сухо, оружие на стене.", "gate"),
    father: { activity: "несёт службу на заставе", at: "gate" }, mother: { activity: "ведёт хозяйство и работает в лазарете заставы", at: "home" }, values: ["клятва", "дисциплина", "род"] },
  { id: "tharvek-foundling", stateId: "tharvek", settlementId: "dravorn", group: "храм", label: "Воспитанник Каменной клятвы", blurb: "Оставлен у святилища. Растят служители камня.", wealthHint: "бедно",
    legacyOriginId: "temple-orphan", statusId: "temple", home: { name: "Приют при святилище Камня", description: "Сводчатый дом при святилище Каменной клятвы. Холодный камень, ровный свет, строгий порядок." }, father: { activity: "", at: "home" }, mother: { activity: "", at: "home" },
    foundling: { guardianTitle: "Наставница", guardianRole: "служительница Камня", clothing: "серая шерстяная ряса служительницы", institutionId: "institution:stone-oath" }, values: ["клятва", "порядок", "вера"] },
  { id: "tharvek-smelter-camp", stateId: "tharvek", settlementId: "deepforge", group: "дно", label: "Ребёнок плавильного посёлка", blurb: "Бараки у плавилен, дым и чужие дети вокруг.", wealthHint: "бедно",
    legacyOriginId: "debt-runaway", statusId: "marginal", home: home("Угол в бараке", "Угол в длинном бараке у плавилен. Нары, дым, чужие голоса за занавеской."),
    work: own("Плавильни", "Печи, шлак, жар и вечный дым над посёлком."),
    father: { activity: "работает подёнщиком у плавилен", at: "work" }, mother: { activity: "стирает и готовит для барака", at: "home" }, values: ["выжить", "не задолжать", "свои рядом"] },
  { id: "tharvek-mountain-house", stateId: "tharvek", settlementId: "dravorn", group: "малый дом", label: "Младший горный род", blurb: "Небольшая крепость, клятвы и долг перед князем.", wealthHint: "в достатке",
    legacyOriginId: "impoverished-noble", statusId: "noble", servants: true, home: home("Родовая башня", "Каменная башня рода у Драворна. Гербовые щиты, холодные залы, верные люди."),
    father: { activity: "служит при княжеском конклаве", at: "square" }, mother: { activity: "ведёт дом и хозяйство рода", at: "home" }, values: ["клятва рода", "честь", "сила"] },

  // Варент
  { id: "varent-salt", stateId: "varent", settlementId: "saltmere", group: "земля", label: "Семья солеваров", blurb: "Соляные варницы и рыбный рынок Солёного Мера.", wealthHint: "бедно",
    legacyOriginId: "tenant-farmer", statusId: "serving", home: home("Дом у варниц", "Дощатый дом у соляных варниц. Соль на губах, на одежде, на всём."),
    work: own("Соляные варницы", "Котлы, рассол, пар и белые кучи соли под навесами."),
    father: { activity: "работает на соляных варницах", at: "work" }, mother: { activity: "продаёт рыбу и ведёт хозяйство", at: "market" }, values: ["труд", "договор", "семья"] },
  { id: "varent-shipwright", stateId: "varent", settlementId: "tidewatch", group: "ремесло", label: "Семья корабельного плотника", blurb: "Верфи Тайд-вотча, смола и стук топоров.", wealthHint: "скромно",
    legacyOriginId: "craft-apprentice", statusId: "guild-free", home: home("Дом у верфей", "Дом в слободе плотников. Запах смолы и свежего дерева, маяк в окне."),
    work: own("Верфь", "Стапели, рёбра недостроенных кораблей, смола и крики мастеров."),
    father: { activity: "строит корабли на верфи", at: "work" }, mother: { activity: "шьёт паруса и ведёт хозяйство", at: "home" }, values: ["мастерство", "цех", "семья"] },
  { id: "varent-weavers", stateId: "varent", settlementId: "merovar", group: "ремесло", label: "Семья ткачей", blurb: "Станки в тесной мастерской, заказы торговых палат.", wealthHint: "скромно",
    legacyOriginId: "craft-apprentice", statusId: "guild-free", home: home("Мастерская-дом ткачей", "Комнаты над мастерской. Стук станков с утра до ночи, нитки повсюду."),
    father: { activity: "ткёт на станке", at: "home" }, mother: { activity: "прядёт, ткёт и ведёт хозяйство", at: "home" }, values: ["заказ в срок", "цех", "семья"] },
  { id: "varent-clerk", stateId: "varent", settlementId: "merovar", group: "торговля", label: "Семья счетовода", blurb: "Отец ведёт книги в финансовом доме Меровара.", wealthHint: "в достатке",
    legacyOriginId: "merchant-child", statusId: "guild-free", home: home("Дом на тихой улице", "Аккуратный дом с книжной полкой и замком на сундуке. Здесь считают каждую монету."),
    work: own("Контора финансового дома", "Высокие конторки, гроссбухи, печати и тихий скрип перьев."),
    father: { activity: "ведёт книги в финансовом доме", at: "work" }, mother: { activity: "ведёт дом и мелкую торговлю кружевом", at: "home" }, values: ["договор", "капитал", "репутация"] },
  { id: "varent-sailors", stateId: "varent", settlementId: "bluehaven", group: "служба", label: "Семья моряка", blurb: "Отец в море месяцами, мать ждёт на берегу.", wealthHint: "бедно",
    legacyOriginId: "caravan-hand", statusId: "serving", home: home("Дом у гавани", "Узкий дом над гаванью. Ракушки на подоконнике, сундук моряка у двери.", "gate"),
    father: { activity: "работает в порту между рейсами", at: "gate" }, mother: { activity: "работает в рыбном ряду и ведёт хозяйство", at: "market" }, values: ["море", "верность команде", "семья"] },
  { id: "varent-foundling", stateId: "varent", settlementId: "varentport", group: "храм", label: "Воспитанник Открытого Фонаря", blurb: "Подкидыш при школе Фонаря в главной гавани.", wealthHint: "бедно",
    legacyOriginId: "temple-orphan", statusId: "temple", home: { name: "Приют школы Открытого Фонаря", description: "Светлый дом при школе Фонаря. Лампы, книги, длинные столы и много детей." }, father: { activity: "", at: "home" }, mother: { activity: "", at: "home" },
    foundling: { guardianTitle: "Наставница", guardianRole: "наставница школы Фонаря", clothing: "тёмное платье с медным фонарём на груди", institutionId: "institution:open-lantern" }, values: ["знание", "милосердие", "вера"] },
  { id: "varent-smugglers", stateId: "varent", settlementId: "bluehaven", group: "дно", label: "Ребёнок портового дна", blurb: "Синяя Гавань: ночные лодки и чужие тайны.", wealthHint: "бедно",
    legacyOriginId: "debt-runaway", statusId: "marginal", home: home("Чердак над таверной", "Чердак в портовом переулке. Ночью внизу гремят кружки, иногда в дверь стучат чужие.", "inn"),
    father: { activity: "перебивается работой в порту и ночными делами", at: "gate" }, mother: { activity: "работает в портовой таверне", at: "inn" }, values: ["молчать", "выжить", "свои рядом"] },
  { id: "varent-shareholder", stateId: "varent", settlementId: "varentport", group: "малый дом", label: "Семья пайщика Лиги", blurb: "Доля в торговом доме и место в гильдейских списках.", wealthHint: "в достатке",
    legacyOriginId: "merchant-child", statusId: "guild-free", servants: true, home: home("Дом с видом на гавань", "Высокий дом с окнами на главную гавань. Карты на стенах, слуги, гости из палат."),
    father: { activity: "ведёт дела торгового дома", at: "market" }, mother: { activity: "ведёт дом и принимает гостей", at: "home" }, values: ["капитал", "договор", "имя семьи"] },

  // Элиндор
  { id: "elyndor-commoners", stateId: "elyndor", settlementId: "mossford", group: "земля", label: "Семья лесных общинников", blurb: "Брод, мох и общинные угодья рода.", wealthHint: "бедно",
    legacyOriginId: "free-farmer", statusId: "rural-free", home: home("Дом под мшистой крышей", "Длинный бревенчатый дом с мшистой крышей у брода. Очаг, шкуры, сушёные грибы."),
    work: own("Общинные угодья", "Лес и поляны рода: ловушки, борти, ягодники."),
    father: { activity: "охотится и работает в угодьях рода", at: "work" }, mother: { activity: "собирает травы и ведёт хозяйство", at: "home" }, values: ["род", "лес", "память предков"] },
  { id: "elyndor-lake-fishers", stateId: "elyndor", settlementId: "lake-ward", group: "земля", label: "Семья озёрных рыбаков", blurb: "Пристани Озёрного Дозора, лёд зимой и сети летом.", wealthHint: "бедно",
    legacyOriginId: "caravan-hand", statusId: "rural-free", home: home("Дом на сваях", "Дом на сваях у рыбацкой пристани. Вода под полом, сети на стенах.", "gate"),
    father: { activity: "рыбачит на озере", at: "gate" }, mother: { activity: "коптит рыбу и ведёт хозяйство", at: "home" }, values: ["озеро", "артель", "семья"] },
  { id: "elyndor-herbalist", stateId: "elyndor", settlementId: "willowmere", group: "ремесло", label: "Семья травницы", blurb: "Сушёные травы под потолком, у рощи всегда тихо.", wealthHint: "скромно",
    legacyOriginId: "independent-craftsman", statusId: "rural-free", home: home("Дом травницы", "Дом на краю деревни у священной рощи. Пучки трав под потолком, ступки и горшки."),
    father: { activity: "рубит дрова и собирает смолу", at: "square" }, mother: { activity: "готовит снадобья и принимает больных", at: "home" }, values: ["знание трав", "лес", "помогать"] },
  { id: "elyndor-carvers", stateId: "elyndor", settlementId: "lethariel", group: "ремесло", label: "Семья резчиков по дереву", blurb: "Мастерская в Летариэле: стружка и узоры родов.", wealthHint: "скромно",
    legacyOriginId: "craft-apprentice", statusId: "guild-free", home: home("Дом резчиков", "Дом с резными наличниками у озера. Стружка, смола, недоделанные узоры."),
    work: own("Мастерская резчиков", "Верстаки, стамески, родовые знаки, вырезанные на заказ."),
    father: { activity: "режет по дереву в мастерской", at: "work" }, mother: { activity: "расписывает изделия и ведёт хозяйство", at: "home" }, values: ["мастерство", "память родов", "семья"] },
  { id: "elyndor-fur-traders", stateId: "elyndor", settlementId: "lake-ward", group: "торговля", label: "Семья скупщиков мехов", blurb: "Меха и смолы на лодках вниз по озёрам.", wealthHint: "скромно",
    legacyOriginId: "small-trader", statusId: "guild-free", home: home("Дом с меховым складом", "Дом с пристроенным складом. Запах шкур и смолы, гости с дальних берегов.", "market"),
    father: { activity: "скупает меха у охотников", at: "market" }, mother: { activity: "ведёт склад и хозяйство", at: "home" }, values: ["выгода", "связи", "семья"] },
  { id: "elyndor-foundling", stateId: "elyndor", settlementId: "willowmere", group: "храм", label: "Найдёныш священной рощи", blurb: "Тебя нашли у корней старого дерева.", wealthHint: "бедно",
    legacyOriginId: "temple-orphan", statusId: "temple", home: { name: "Дом хранителей рощи", description: "Низкий дом хранителей у священной рощи. Тишина, птицы, запах прелой листвы." }, father: { activity: "", at: "home" }, mother: { activity: "", at: "home" },
    foundling: { guardianTitle: "Хранительница", guardianRole: "хранительница рощи", clothing: "зелёный плащ хранительницы", institutionId: "institution:green-memory" }, values: ["лес помнит", "милосердие", "вера"] },
  { id: "elyndor-loggers", stateId: "elyndor", settlementId: "lethariel", group: "дно", label: "Ребёнок пришлых лесорубов", blurb: "Лагерь лесорубов, которых не любят общины.", wealthHint: "бедно",
    legacyOriginId: "debt-runaway", statusId: "marginal", home: home("Шалаш в лагере лесорубов", "Шалаш из жердей в лагере за городом. Костёр, топоры, косые взгляды горожан.", "gate"),
    father: { activity: "рубит лес по найму", at: "gate" }, mother: { activity: "готовит для лагеря и ведёт хозяйство", at: "home" }, values: ["выжить", "держаться своих", "не верить общинам"] },
  { id: "elyndor-elder-kin", stateId: "elyndor", settlementId: "lethariel", group: "малый дом", label: "Семья старейшины рода", blurb: "Род с голосом в Совете Рощ и старой памятью.", wealthHint: "в достатке",
    legacyOriginId: "impoverished-noble", statusId: "noble", servants: true, home: home("Родовой дом у озера", "Большой резной дом рода у озера. Родовые знаки, длинный стол, гости из Совета."),
    father: { activity: "заседает в Совете Старших Рощ", at: "square" }, mother: { activity: "ведёт дом и родовую память", at: "home" }, values: ["память рода", "лес", "честь"] },

  // Кхарум
  { id: "kharum-rice", stateId: "kharum", settlementId: "reedhaven", group: "земля", label: "Семья рисоводов", blurb: "Залитые поля дельты, баржи и сезон дождей.", wealthHint: "бедно",
    legacyOriginId: "tenant-farmer", statusId: "rural-free", home: home("Дом на насыпи", "Дом на земляной насыпи между полями. В сезон дождей вода у самого порога."),
    work: own("Рисовые поля", "Залитые поля дельты, мутная вода по колено, цапли и пиявки."),
    father: { activity: "работает на рисовом поле", at: "work" }, mother: { activity: "сажает рис и ведёт хозяйство", at: "work" }, values: ["урожай", "налог в срок", "семья"] },
  { id: "kharum-potters", stateId: "kharum", settlementId: "namar", group: "ремесло", label: "Семья гончаров", blurb: "Круг, печь и кхарумская керамика на рынок.", wealthHint: "скромно",
    legacyOriginId: "craft-apprentice", statusId: "guild-free", home: home("Дом гончаров", "Дом во дворе с печью для обжига. Глина на всём, ряды сохнущих сосудов."),
    work: own("Гончарная мастерская", "Круги, печь для обжига, полки с посудой на продажу."),
    father: { activity: "работает за гончарным кругом", at: "work" }, mother: { activity: "расписывает посуду и торгует ею", at: "market" }, values: ["мастерство", "порядок", "семья"] },
  { id: "kharum-weavers", stateId: "kharum", settlementId: "namar", group: "ремесло", label: "Семья хлопкоткачей", blurb: "Хлопок, станки и рисовые рынки Намара.", wealthHint: "бедно",
    legacyOriginId: "craft-apprentice", statusId: "serving", home: home("Комнаты в ткацком дворе", "Комнаты вокруг общего двора ткачей. Станки стучат, хлопковая пыль в воздухе."),
    father: { activity: "ткёт хлопок в общем дворе", at: "home" }, mother: { activity: "прядёт хлопок и ведёт хозяйство", at: "home" }, values: ["труд", "община", "семья"] },
  { id: "kharum-customs-traders", stateId: "kharum", settlementId: "ivory-gate", group: "торговля", label: "Семья торговцев у таможни", blurb: "Имперская дорога, пошлины и караваны с юга.", wealthHint: "в достатке",
    legacyOriginId: "merchant-child", statusId: "guild-free", home: home("Дом торговцев", "Дом с лавкой у таможенного двора. Тюки, печати, вечные споры о пошлинах.", "market"),
    father: { activity: "торгует у таможенного двора", at: "market" }, mother: { activity: "ведёт книги лавки и хозяйство", at: "home" }, values: ["выгода", "связи с чиновниками", "семья"] },
  { id: "kharum-scribe", stateId: "kharum", settlementId: "azrakar", group: "служба", label: "Семья младшего писца", blurb: "Отец переписывает реестры в верхнем архиве.", wealthHint: "скромно",
    legacyOriginId: "small-trader", statusId: "serving", home: home("Дом писца", "Тихий дом в квартале писцов. Свитки, тушь, строгий порядок."),
    work: own("Верхний архив", "Ряды полок с реестрами, писцы за низкими столами, надзиратели."),
    father: { activity: "переписывает реестры в архиве", at: "work" }, mother: { activity: "ведёт дом и учит детей счёту", at: "home" }, values: ["экзамен", "порядок", "доброе имя"] },
  { id: "kharum-palace-servants", stateId: "kharum", settlementId: "har-kadar", group: "служба", label: "Ребёнок дворцовой прислуги", blurb: "Мать служит в доме при императорском дворе.", wealthHint: "скромно",
    legacyOriginId: "small-trader", statusId: "serving", home: home("Комната в квартале слуг", "Комната в квартале слуг у дворцовых каналов. Чисто, тесно и всегда кто-то слушает.", "square"),
    father: { activity: "служит лодочником при дворцовых каналах", at: "square" }, mother: { activity: "служит в доме сановника при дворе", at: "square" }, values: ["место при дворе", "молчание", "семья"] },
  { id: "kharum-foundling", stateId: "kharum", settlementId: "sunspire", group: "храм", label: "Воспитанник Солнечного Шпиля", blurb: "Оставлен у храмовой школы, растят монахи.", wealthHint: "бедно",
    legacyOriginId: "temple-orphan", statusId: "temple", home: { name: "Детский двор Солнечного Шпиля", description: "Двор храмовой школы. Колокола, свитки, бритые головы и строгое расписание." }, father: { activity: "", at: "home" }, mother: { activity: "", at: "home" },
    foundling: { guardianTitle: "Наставница", guardianRole: "монахиня Солнца", clothing: "шафрановое одеяние храмовой школы", institutionId: "institution:imperial-sun" }, values: ["порядок", "учение", "вера"] },
  { id: "kharum-canal-slums", stateId: "kharum", settlementId: "har-kadar", group: "дно", label: "Ребёнок канальных трущоб", blurb: "Лодочные лачуги у главных каналов столицы.", wealthHint: "бедно",
    legacyOriginId: "debt-runaway", statusId: "marginal", home: home("Лодка-лачуга", "Старая лодка под навесом у канала. Гнилая вода, соседи борт к борту.", "gate"),
    father: { activity: "таскает грузы на каналах", at: "gate" }, mother: { activity: "продаёт еду с лодки", at: "market" }, values: ["выжить", "не попадаться страже", "свои рядом"] },
  { id: "kharum-official", stateId: "kharum", settlementId: "har-kadar", group: "малый дом", label: "Семья чиновника", blurb: "Отец сдал экзамен и получил небольшую должность.", wealthHint: "в достатке",
    legacyOriginId: "merchant-child", statusId: "noble", servants: true, home: home("Дом чиновника", "Дом с садиком в чиновничьем квартале. Ширмы, печати, слуги и визиты сослуживцев."),
    work: own("Провинциальное управление", "Залы с ширмами, реестры, просители в очереди."),
    father: { activity: "служит в провинциальном управлении", at: "work" }, mother: { activity: "ведёт дом и связи семьи", at: "home" }, values: ["должность", "экзамен", "лицо семьи"] }
];

export const birthOrigin = (id: string | undefined): BirthOrigin | undefined => BIRTH_ORIGINS.find(origin => origin.id === id);
export const originsOfState = (stateId: StateId): BirthOrigin[] => BIRTH_ORIGINS.filter(origin => origin.stateId === stateId);
export const MAX_BIRTH_START_AGE = 12;
