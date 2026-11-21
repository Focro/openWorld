/**
 * Ровен: десять жителей (0.19.0, предложение канона, образец для остальных мест).
 *
 * Опора на канон: торговый город у переправы через Лир (659 КЛ), хартия рынка и совета (701 КЛ),
 * совет из девяти мест (четыре гильдейских, два землевладельцев, два королевских, одно храмовое),
 * Война трёх вассалов (730 КЛ), задержки зерновых обозов (742 КЛ), спор о мостовых пошлинах,
 * храм Семерых с приютом и школой грамоты, суда в Варенпорт и Мираж, слух о «Ночном реестре».
 *
 * Пятеро прежних жителей (Марта Вейл, Орн Келлер, сержант Бран, сестра Ален, Элрик Данн) не
 * меняются: новые люди только знакомы с ними, родни им не придумано.
 */
import type { PersonalityTraits } from "../../../engine/types";
import type { ResidentDef } from "./types";
import { resident } from "./build";

const t = (warmth: number, sociability: number, assertiveness: number, emotionalReactivity: number, patience: number, openness: number, discipline: number, suspicion: number, empathy: number, pride: number): PersonalityTraits =>
  ({ warmth, sociability, assertiveness, emotionalReactivity, patience, openness, discipline, suspicion, empathy, pride });

export const ROVEN_RESIDENTS: ResidentDef[] = [
  resident({
    id: "roven:hugo-tiller", name: "Хьюго Тиллер", settlementId: "roven", originStateId: "estran", sex: "male",
    birth: { year: 691, month: 7, day: 14 }, occupation: "хозяин постоялого двора «Серая лисица»", household: "Тиллеры, «Серая лисица»",
    homeId: "grey-fox", roleTags: ["merchant", "commoner"], faith: "sevenfold",
    look: { skinTone: 2, naturalHairColor: "светло-русые, сильно поредевшие", hairTexture: "прямые", eyeColor: "серые", facialFeatures: "широкие" },
    hairstyle: "остатки волос коротко острижены", facialHair: "густые бакенбарды", clothing: "жилет из бурого сукна, рукава закатаны, полотенце через плечо",
    build: "среднего роста, грузный, красное обветренное лицо, толстые пальцы в мелких ожогах от котлов",
    temperament: "радушный на людях, тревожный и прижимистый наедине",
    traits: t(66, 84, 55, 58, 52, 50, 61, 57, 51, 58),
    values: ["доброе имя двора", "семья", "чтобы долги возвращали"],
    formative: ["В 730 КЛ, в Войну трёх вассалов, через двор шли солдаты обеих сторон, и он научился улыбаться всем и никому не верить в долг."],
    coping: ["шутит громче, когда боится", "считает выручку по второму разу, если в городе плохие вести"],
    habits: [
      { id: "wipes-counter", label: "вытирает стойку, пока слушает собеседника", trigger: "разговор у стойки", strength: 80 },
      { id: "night-tally", label: "ночью при свече сводит счёт дня и записывает, кто должен", trigger: "закрытие двора", strength: 74 }
    ],
    goals: ["Пережить зиму без новых долгов", "Удержать сына дома, а не на варенпортском корабле"],
    fears: ["что двор уйдёт за долги", "что Матис уплывёт и не вернётся"],
    speech: "громко и весело, всех зовёт «сосед», сыплет прибаутками; о деньгах вдруг сухо и коротко",
    quirks: ["помнит, кто что пил в прошлый раз", "держит у двери доску объявлений и сам читает её вслух неграмотным"],
    links: [
      { to: "roven:adelina-tiller", kind: "spouse", note: "женаты с 721 КЛ, она решает больше, чем он признаёт" },
      { to: "roven:matis-tiller", kind: "parent", note: "единственный выживший сын" },
      { to: "marta", kind: "employer", note: "Марта по вечерам помогает в зале, он ценит её и платит медью" },
      { to: "orn", kind: "friend", note: "кузнец ужинает у него с возчиками, оба не любят пустых обещаний" }
    ],
    schedule: [
      { from: 5, to: 7, locationId: "lower-market", activity: "закупает хлеб, мясо и пиво на день" },
      { from: 7, to: 24, locationId: "grey-fox", activity: "держит стойку и общий зал" }
    ]
  }),
  resident({
    id: "roven:adelina-tiller", name: "Аделина Тиллер", settlementId: "roven", originStateId: "estran", sex: "female",
    birth: { year: 695, month: 3, day: 3 }, birthplaceId: "westmere", occupation: "хозяйка кухни и комнат «Серой лисицы»", household: "Тиллеры, «Серая лисица»",
    homeId: "grey-fox", roleTags: ["merchant", "commoner"], faith: "sevenfold",
    look: { skinTone: 2, naturalHairColor: "тёмно-каштановые с первой сединой", hairTexture: "волнистые", eyeColor: "карие", facialFeatures: "узкие" },
    hairstyle: "коса, уложенная венцом под чепцом", clothing: "серое платье, длинный холщовый передник, связка ключей на поясе",
    build: "высокая, худая, прямая спина, сухие руки с коротко обрезанными ногтями",
    temperament: "сдержанная, наблюдательная, твёрдая",
    traits: t(54, 38, 70, 32, 74, 44, 86, 69, 62, 60),
    values: ["мера", "порядок в доме", "правда без лишних слов"],
    formative: ["Выросла в Вестмере в семье свободных земледельцев, где каждый мешок зерна считали; в Ровен вышла замуж в двадцать шесть."],
    coping: ["молча берёт дело в свои руки", "при обиде становится подчёркнуто вежливой"],
    habits: [
      { id: "keys-check", label: "трогает ключи на поясе, проверяя, все ли на месте", trigger: "вход чужого человека", strength: 70 },
      { id: "morning-lamp", label: "до рассвета зажигает домашний светильник и молча стоит у него", trigger: "начало дня", strength: 76 }
    ],
    goals: ["Решать, кому из постояльцев давать в долг, а кому нет", "Выдать Матиса в ученики к честному мастеру"],
    fears: ["пьяная драка с ножом в зале", "что муж что-то скрывает"],
    speech: "мало и точно, короткие вопросы по делу, поговорки о мере; с должниками холодно вежлива",
    quirks: ["по шагам на лестнице узнаёт, кто идёт", "никогда не садится при постояльцах"],
    links: [
      { to: "roven:hugo-tiller", kind: "spouse" },
      { to: "roven:matis-tiller", kind: "parent", note: "любит строго, ждёт от него больше, чем он может" },
      { to: "sister_alen", kind: "friend", note: "носит в приют остатки кухни, доверяет ей деньги" },
      { to: "westmere:adelina_kin", kind: "sibling", note: "младший брат Йорик держит родительский надел в Вестмере" }
    ],
    schedule: [
      { from: 4, to: 22, locationId: "grey-fox", activity: "ведёт кухню, комнаты и счёт постояльцев" },
      { from: 14, to: 15, locationId: "temple", activity: "относит еду в приют" }
    ]
  }),
  resident({
    id: "roven:matis-tiller", name: "Матис Тиллер", settlementId: "roven", originStateId: "estran", sex: "male",
    birth: { year: 725, month: 10, day: 22 }, occupation: "подавальщик в «Серой лисице»", household: "Тиллеры, «Серая лисица»",
    homeId: "grey-fox", roleTags: ["commoner"], faith: "sevenfold",
    look: { skinTone: 2, naturalHairColor: "русые", hairTexture: "волнистые", eyeColor: "серые", facialFeatures: "узкие" },
    hairstyle: "отросшие вихры, падают на глаза", clothing: "застиранная рубаха навыпуск, матросский платок на шее",
    build: "долговязый, ещё нескладный, длинные руки, ссадины на костяшках",
    temperament: "мечтательный, порывистый, обидчивый",
    traits: t(63, 74, 48, 76, 30, 82, 34, 33, 58, 63),
    values: ["свобода", "море и дальние города", "чтобы его принимали всерьёз"],
    formative: ["Двое младших братьев умерли во младенчестве; он рос единственным, под тяжёлым вниманием родителей."],
    coping: ["убегает на причал и смотрит на суда", "хвастается, когда неуверен"],
    habits: [
      { id: "dock-escape", label: "сбегает на речной причал, как только отец отвернётся", trigger: "свободная минута", strength: 72 },
      { id: "sailor-words", label: "вставляет в речь услышанные от моряков словечки", trigger: "разговор со сверстниками", strength: 60 }
    ],
    goals: ["Наняться юнгой на судно до Варенпорта", "Доказать отцу, что он не ребёнок"],
    fears: ["остаться навсегда за стойкой", "что его поднимут на смех"],
    speech: "быстро, перескакивает с мысли на мысль, морские словечки невпопад, хвастает и тут же смущается",
    quirks: ["знает по именам все суда, что приходят из Миража", "носит в кармане медную монету с Медного побережья"],
    links: [
      { to: "roven:hugo-tiller", kind: "child" },
      { to: "roven:adelina-tiller", kind: "child" },
      { to: "roven:renar-brook", kind: "friend", note: "старшина грузчиков пускает его таскать мешки за медь" }
    ],
    schedule: [
      { from: 7, to: 12, locationId: "grey-fox", activity: "подаёт и моет посуду" },
      { from: 12, to: 15, locationId: "river-dock", activity: "крутится у судов и грузчиков" },
      { from: 15, to: 23, locationId: "grey-fox", activity: "подаёт в общем зале" }
    ]
  }),
  resident({
    id: "roven:edmund-haldon", name: "Эдмунд Хэлдон", settlementId: "roven", originStateId: "estran", sex: "male",
    birth: { year: 684, month: 8, day: 9 }, birthplaceId: "koronholm", occupation: "королевский сборщик речных и мостовых пошлин, одно из двух королевских мест в совете", household: "Хэлдоны, Верхняя улица",
    homeId: "upper-street", roleTags: ["commoner"], faith: "sevenfold",
    look: { skinTone: 1, naturalHairColor: "седые, когда-то тёмно-русые", hairTexture: "прямые", eyeColor: "голубые, выцветшие", facialFeatures: "угловатые" },
    hairstyle: "волосы гладко зачёсаны назад", clothing: "чёрный кафтан чиновника, королевская бляха на цепи, чернильное пятно на манжете",
    build: "сухой, сутулый, высокий, длинные пальцы, очки для чтения на шнурке",
    temperament: "педантичный, честный, несгибаемый",
    traits: t(31, 30, 74, 28, 70, 26, 95, 72, 39, 77),
    values: ["закон и грамота", "казна короны", "неподкупность"],
    formative: ["Получил место при воцарении Элианы III в 735 КЛ; за семь лет ни разу не взял подарка, и весь город это знает и не любит его за это."],
    coping: ["уходит в бумаги", "при давлении цитирует грамоту дословно"],
    habits: [
      { id: "double-seal", label: "дважды проверяет каждую печать", trigger: "чужой документ", strength: 88 },
      { id: "same-route", label: "ходит одним и тем же путём, причал, ратуша, дом", trigger: "каждый день", strength: 80 }
    ],
    goals: ["Собрать пошлины этого года сполна, несмотря на задержку обозов", "Не дать совету урезать королевскую долю мостового сбора"],
    fears: ["ошибка в отчёте короне", "остаться одному, когда дочь уйдёт из дома"],
    speech: "канцелярские обороты, «согласно грамоте», точные числа и даты; не шутит и не переспрашивает",
    quirks: ["носит при себе таблицу пошлин и может назвать любую по памяти", "вдовец, по Ночам Памяти сам читает имя жены в храме"],
    links: [
      { to: "roven:clara-haldon", kind: "parent", note: "гордится её грамотностью и боится её упрямства" },
      { to: "roven:adrien-merr", kind: "rival", note: "в совете Мерр требует снизить мостовой сбор для гильдии" },
      { to: "sergeant", kind: "client", note: "стража у Южных ворот сверяет с ним обозы" }
    ],
    schedule: [
      { from: 6, to: 11, locationId: "river-dock", activity: "взвешивает грузы и берёт пошлину" },
      { from: 11, to: 17, locationId: "town-hall", activity: "сводит записи, заседает в совете" },
      { from: 17, to: 22, locationId: "upper-street", activity: "дома, работает с бумагами" }
    ]
  }),
  resident({
    id: "roven:clara-haldon", name: "Клара Хэлдон", settlementId: "roven", originStateId: "estran", sex: "female",
    birth: { year: 718, month: 4, day: 27 }, occupation: "писарь нотариальной конторы на Верхней улице", household: "Хэлдоны, Верхняя улица",
    homeId: "upper-street", roleTags: ["commoner"], faith: "sevenfold",
    look: { skinTone: 1, naturalHairColor: "тёмно-русые", hairTexture: "прямые", eyeColor: "голубые", facialFeatures: "угловатые" },
    hairstyle: "волосы туго заплетены и убраны под сетку", clothing: "тёмно-синее платье с нарукавниками, перо за ухом",
    build: "невысокая, тонкая, быстрые движения, чернила въелись в пальцы правой руки",
    temperament: "умная, ироничная, нетерпеливая",
    traits: t(50, 58, 66, 55, 38, 80, 74, 52, 56, 67),
    values: ["знание", "собственное имя, а не отцовское", "справедливость к слабым"],
    formative: ["Мать умерла от лихорадки в 738 КЛ; Клара заменила отцу секретаря и поняла, что пишет лучше многих нотариусов."],
    coping: ["отвечает колкостью", "ночами переписывает бумаги, чтобы не думать"],
    habits: [
      { id: "reads-everything", label: "читает любую бумагу, оказавшуюся на виду, даже вверх ногами", trigger: "бумага на столе", strength: 77 },
      { id: "sharp-reply", label: "отвечает на снисходительность колкостью", trigger: "снисходительный собеседник", strength: 64 }
    ],
    goals: ["Сдать испытание на нотариуса, хотя гильдия женщин не любит", "Понять, кто подделывает долговые расписки на Нижнем рынке"],
    fears: ["всю жизнь переписывать чужие бумаги", "что отец выберет ей мужа сам"],
    speech: "быстро и точно, с иронией; с незнакомыми переходит на книжную речь, с друзьями говорит просто",
    quirks: ["считает в уме быстрее счётов", "ест на ходу, забывая обедать"],
    links: [
      { to: "roven:edmund-haldon", kind: "child" }
    ],
    schedule: [
      { from: 7, to: 16, locationId: "upper-street", activity: "переписывает договоры в нотариальной конторе" },
      { from: 16, to: 18, locationId: "guild-house", activity: "носит бумаги в контору гильдии" },
      { from: 18, to: 23, locationId: "upper-street", activity: "дома, читает и пишет" }
    ]
  }),
  resident({
    id: "roven:renar-brook", name: "Ренар Брук", settlementId: "roven", originStateId: "estran", sex: "male",
    birth: { year: 703, month: 6, day: 1 }, occupation: "старшина артели грузчиков речного причала", household: "Бруки, Старый квартал",
    homeId: "old-quarter", roleTags: ["commoner"], faith: "sevenfold",
    look: { skinTone: 3, naturalHairColor: "тёмно-каштановые", hairTexture: "курчавые", eyeColor: "ореховые", facialFeatures: "широкие" },
    hairstyle: "коротко стриженные курчавые волосы", facialHair: "жёсткая борода с проседью", clothing: "кожаный наплечник грузчика, холщовые штаны, широкий пояс",
    build: "кряжистый, широкий в плечах, на левой руке нет двух пальцев, сломанный нос",
    temperament: "грубоватый, вспыльчивый, верный своим",
    traits: t(58, 56, 80, 72, 40, 36, 63, 64, 61, 69),
    values: ["своя артель", "честная плата", "не бросать товарища"],
    formative: ["В 730 КЛ, в Войну трёх вассалов, служил в ополчении под началом Брана; пальцы оставил на переправе через Лир."],
    coping: ["бьёт кулаком по ближайшему ящику", "успокаивается работой до седьмого пота"],
    habits: [
      { id: "counts-crew", label: "пересчитывает своих людей в начале и конце смены", trigger: "начало или конец смены", strength: 82 },
      { id: "stump-rub", label: "трёт обрубки пальцев, когда злится или к дождю", trigger: "злость или сырость", strength: 58 }
    ],
    goals: ["Выбить из гильдии плату артели за три задержанных обоза", "Скопить Эне на ученичество к белошвейке"],
    fears: ["что артель разбредётся по чужим причалам", "огонь на складах"],
    speech: "хрипло и коротко, крепкие словечки, солдатские обороты; с детьми и женой неожиданно мягок",
    quirks: ["свистом подзывает людей через весь причал", "никогда не пьёт больше двух кружек"],
    links: [
      { to: "roven:brenna-brook", kind: "spouse", note: "женаты с 731 КЛ, познакомились, когда она перевязывала ему руку" },
      { to: "roven:ena-brook", kind: "parent" },
      { to: "sergeant", kind: "former-comrade", note: "служил под его началом в 730 КЛ, уважает, но не во всём согласен" },
      { to: "roven:adrien-merr", kind: "rival", note: "гильдия задерживает плату артели" },
      { to: "roven:matis-tiller", kind: "employer", note: "даёт парню подработку, присматривает за ним" }
    ],
    schedule: [
      { from: 5, to: 18, locationId: "river-dock", activity: "ведёт артель на разгрузке" },
      { from: 18, to: 20, locationId: "grey-fox", activity: "две кружки и новости" },
      { from: 20, to: 24, locationId: "old-quarter", activity: "дома с семьёй" }
    ]
  }),
  resident({
    id: "roven:brenna-brook", name: "Бренна Брук", settlementId: "roven", originStateId: "estran", sex: "female",
    birth: { year: 706, month: 9, day: 18 }, occupation: "прачка, держит общий прачечный двор Старого квартала", household: "Бруки, Старый квартал",
    homeId: "old-quarter", roleTags: ["commoner"], faith: "sevenfold",
    look: { skinTone: 2, naturalHairColor: "рыжие", hairTexture: "волнистые", eyeColor: "зелёные", facialFeatures: "мягкие" },
    hairstyle: "волосы подвязаны платком, пряди выбиваются", clothing: "подоткнутая юбка, мокрый передник, рукава до плеч",
    build: "плотная, круглолицая, веснушки, красные распаренные руки",
    temperament: "тёплая, говорливая, любопытная",
    traits: t(86, 90, 50, 64, 60, 72, 52, 34, 80, 40),
    values: ["соседи", "дети квартала", "чтобы никто не голодал"],
    formative: ["Осталась сиротой в двенадцать, выросла в храмовом приюте и до сих пор считает тамошних детей своими."],
    coping: ["пересказывает беду соседкам, пока не станет легче", "берётся кормить всех подряд"],
    habits: [
      { id: "gossip-relay", label: "передаёт услышанное дальше, всегда со словом «говорят»", trigger: "свежий слух", strength: 84 },
      { id: "feeds-kids", label: "суёт чужим детям хлеб", trigger: "голодный ребёнок рядом", strength: 70 }
    ],
    goals: ["Чтобы Эна выучилась грамоте и не стояла у корыта", "Уговорить мужа не ссориться с гильдией в открытую"],
    fears: ["что Ренара покалечат на причале", "лихорадка в квартале"],
    speech: "певуче и много, «милок», «голубушка», пересказывает слухи с подробностями и своими догадками",
    quirks: ["знает, у кого в квартале что болит и кто кому должен", "поёт за работой старые приютские песни"],
    links: [
      { to: "roven:renar-brook", kind: "spouse" },
      { to: "roven:ena-brook", kind: "parent" },
      { to: "roven:gerda-lindel", kind: "friend", note: "Герда принимала у неё Эну" },
      { to: "sister_alen", kind: "friend", note: "бывшая приютская, помогает храму стиркой" }
    ],
    schedule: [
      { from: 5, to: 15, locationId: "old-quarter", activity: "стирает на общем дворе" },
      { from: 15, to: 17, locationId: "lower-market", activity: "разносит бельё и собирает новости" },
      { from: 17, to: 23, locationId: "old-quarter", activity: "дома и у соседок" }
    ]
  }),
  resident({
    id: "roven:ena-brook", name: "Эна Брук", settlementId: "roven", originStateId: "estran", sex: "female",
    birth: { year: 733, month: 1, day: 5 }, occupation: "ученица храмовой школы грамоты, бегает с поручениями", household: "Бруки, Старый квартал",
    homeId: "old-quarter", roleTags: ["commoner"], faith: "sevenfold",
    look: { skinTone: 2, naturalHairColor: "медно-рыжие", hairTexture: "курчавые", eyeColor: "ореховые", facialFeatures: "мягкие" },
    hairstyle: "две растрёпанные косички", clothing: "перешитое из маминого платьице, босиком до холодов",
    build: "маленькая для своих лет, худенькая, вечно сбитые коленки, щербинка на месте выпавшего зуба",
    temperament: "бойкая, любопытная, упрямая",
    traits: t(74, 80, 62, 70, 28, 90, 30, 30, 66, 52),
    values: ["правда", "мама и папа", "узнать всё на свете"],
    formative: ["Сестра Ален похвалила её за чтение при всём классе, и теперь Эна читает каждую вывеску вслух."],
    coping: ["прячется под мостками причала", "задаёт ещё больше вопросов"],
    habits: [
      { id: "reads-signs", label: "читает вслух все вывески и надписи по слогам", trigger: "надпись на пути", strength: 75 },
      { id: "why", label: "спрашивает «а почему?» до тех пор, пока взрослый не сдастся", trigger: "непонятное", strength: 80 }
    ],
    goals: ["Выучить все буквы раньше всех в классе", "Увидеть настоящий корабль из Миража изнутри"],
    fears: ["тёмная вода под причалом", "когда папа кричит"],
    speech: "тараторит, путает длинные слова, говорит что думает, гордится, что умеет читать",
    quirks: ["собирает красивые пуговицы", "передразнивает походку сборщика Хэлдона"],
    links: [
      { to: "roven:renar-brook", kind: "child" },
      { to: "roven:brenna-brook", kind: "child" },
      { to: "sister_alen", kind: "apprentice", note: "учится грамоте в храмовой школе" }
    ],
    schedule: [
      { from: 7, to: 12, locationId: "old-quarter", activity: "помогает матери на прачечном дворе" },
      { from: 12, to: 16, locationId: "temple", activity: "учится грамоте у сестры Ален" },
      { from: 16, to: 19, locationId: "lower-market", activity: "бегает с поручениями и глазеет" },
      { from: 19, to: 24, locationId: "old-quarter", activity: "дома" }
    ]
  }),
  resident({
    id: "roven:adrien-merr", name: "Адриен Мерр", settlementId: "roven", originStateId: "estran", sex: "male",
    birth: { year: 680, month: 12, day: 30 }, occupation: "казначей торговой гильдии, одно из четырёх гильдейских мест в совете", household: "Мерры, Верхняя улица",
    homeId: "upper-street", roleTags: ["merchant"], faith: "sevenfold",
    look: { skinTone: 2, naturalHairColor: "серебристо-седые, в молодости чёрные", hairTexture: "волнистые", eyeColor: "тёмно-карие", facialFeatures: "узкие" },
    hairstyle: "волосы аккуратно подстрижены по плечи", facialHair: "гладко выбрит", clothing: "дорогой тёмно-зелёный камзол без украшений, перстень гильдии",
    build: "среднего роста, сухощавый, ухоженные руки, мягкая бесшумная походка",
    temperament: "учтивый, расчётливый, холодный",
    traits: t(28, 62, 72, 18, 90, 46, 88, 80, 24, 82),
    values: ["влияние гильдии", "порядок в долговых книгах", "собственная репутация"],
    formative: ["Пережил в юности разорение отца, должника варентских домов; с тех пор считает, что долг это власть, а жалость роскошь."],
    coping: ["становится ещё вежливее", "откладывает решение и наблюдает"],
    habits: [
      { id: "allow-me", label: "переспрашивает, чтобы собеседник сам повторил свои слова", trigger: "спор", strength: 72 },
      { id: "ledger-evening", label: "по вечерам лично просматривает долговые книги", trigger: "вечер", strength: 85 }
    ],
    goals: ["Снизить мостовой сбор для гильдейских обозов через совет", "Прибрать к рукам «Серую лисицу»"],
    fears: ["что совет его переиграет", "старость без власти"],
    speech: "мягко и вкрадчиво, никогда не повышает голос, «позвольте уточнить», длинные учтивые фразы с подвохом",
    quirks: ["пьёт только разбавленное вино", "помнит дни рождения всех членов совета и всегда поздравляет"],
    links: [
      { to: "roven:edmund-haldon", kind: "rival", note: "спорят в совете о мостовом сборе" },
      { to: "elric", kind: "rival", note: "гильдия обвиняет семью Данна в пропаже обоза" },
      { to: "roven:renar-brook", kind: "rival", note: "задерживает плату артели" }
    ],
    schedule: [
      { from: 8, to: 14, locationId: "guild-house", activity: "ведёт казну гильдии" },
      { from: 14, to: 17, locationId: "town-hall", activity: "в совете и у судейских" },
      { from: 17, to: 23, locationId: "upper-street", activity: "дома, долговые книги" }
    ]
  }),
  resident({
    id: "roven:gerda-lindel", name: "Герда Линдел", settlementId: "roven", originStateId: "estran", sex: "female",
    birth: { year: 671, month: 11, day: 12 }, birthplaceId: "ashcombe", occupation: "повитуха и травница Старого квартала", household: "Герда Линдел, Старый квартал",
    homeId: "old-quarter", roleTags: ["healer", "commoner"], faith: "ancestors",
    look: { skinTone: 2, naturalHairColor: "белые", hairTexture: "прямые", eyeColor: "серые, с бельмом на левом", facialFeatures: "угловатые" },
    hairstyle: "тонкая коса до пояса", clothing: "тёмная шерстяная накидка, мешочки с травами на поясе",
    build: "маленькая, согнутая, ходит с ольховой клюкой, руки узловатые, но твёрдые",
    temperament: "ворчливая, суеверная, бесстрашная",
    traits: t(60, 50, 76, 46, 64, 40, 70, 66, 74, 72),
    values: ["жизнь матери и ребёнка", "старые обычаи", "своё ремесло"],
    formative: ["Пришла в Ровен из Эшкомба молодой вдовой; за пятьдесят лет приняла роды у половины Старого квартала."],
    coping: ["ворчит и делает", "кладёт на порог веточку рябины"],
    habits: [
      { id: "rowan-sprig", label: "кладёт рябиновую веточку у двери роженицы", trigger: "роды", strength: 78 },
      { id: "calls-kids", label: "зовёт всех младше шестидесяти «детками»", trigger: "любой разговор", strength: 66 }
    ],
    goals: ["Передать ремесло ученице, пока руки держат", "Дожить до весны"],
    fears: ["умереть, не передав ремесло", "что храм запретит её обряды"],
    speech: "старчески неторопливо, ворчит, поговорки северных холмов, всех зовёт «детка»; о родах говорит прямо и без стыда",
    quirks: ["видит одним глазом и поворачивает голову к собеседнику", "держит в доме ворону с перебитым крылом"],
    links: [
      { to: "roven:brenna-brook", kind: "friend", note: "принимала у неё Эну" },
      { to: "roven:matis-tiller", kind: "neighbor", note: "принимала и его, до сих пор зовёт «тот крикун»" },
      { to: "sister_alen", kind: "rival", note: "уважают друг друга, но спорят о травах и обрядах" }
    ],
    schedule: [
      { from: 6, to: 12, locationId: "old-quarter", activity: "принимает больных и сушит травы" },
      { from: 12, to: 14, locationId: "lower-market", activity: "покупает и меняет травы" },
      { from: 14, to: 22, locationId: "old-quarter", activity: "дома, ходит к роженицам по вызову" }
    ]
  })
];
