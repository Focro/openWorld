/**
 * Дополнительные дома Ардана (0.14.0): ПРЕДЛОЖЕНИЕ ПРОЕКТА, а не канон 1.0.
 *
 * Автор мира попросил больше домов с собственными характерами. Канонические 30 домов
 * (nobleHouses.ts) не меняются; здесь по три новых дома на каждое государство.
 * Каждый дом помечен canonStatus: "proposal" и может быть изменён или удалён автором.
 *
 * Правила, которые соблюдены:
 *  - имена по традиции своей страны (populations.ts);
 *  - даты не создают древность задним числом: основатель новой ветви не получает выдуманных предков;
 *  - правило наследования соответствует устройству государства и задано структурно (successionRule),
 *    а итог зависит от состава семьи (см. nobleHouses.ts → heirCandidates).
 */
import type { DynasticHouse, GenealogyMember } from "./nobleHouses";

const m = (id: string, name: string, birthYear: number, role: string, parentIds: string[] = [], spouseIds: string[] = [], notes = ""): GenealogyMember =>
  ({ id, name, birthYear, status: "alive", role, parentIds, ancestorIds: [], spouseIds, legitimacy: "legitimate", notes });
const dead = (id: string, name: string, birthYear: number, deathYear: number, role: string, parentIds: string[] = [], spouseIds: string[] = [], notes = ""): GenealogyMember =>
  ({ ...m(id, name, birthYear, role, parentIds, spouseIds, notes), status: "dead", deathYear });
const ack = (id: string, name: string, birthYear: number, role: string, parentIds: string[] = [], notes = ""): GenealogyMember =>
  ({ ...m(id, name, birthYear, role, parentIds, [], notes), legitimacy: "acknowledged" });
const foreign = (member: GenealogyMember, originStateId: string): GenealogyMember => ({ ...member, originStateId });
const adopted = (id: string, name: string, birthYear: number, role: string, parentIds: string[] = [], notes = ""): GenealogyMember =>
  ({ ...m(id, name, birthYear, role, parentIds, [], notes), legitimacy: "adopted" });

type ProposedHouse = Omit<DynasticHouse, "countryId">;
const house = (x: Omit<ProposedHouse, "canonStatus">): ProposedHouse => ({ ...x, canonStatus: "proposal" });

export const PROPOSED_RAW_HOUSES: ProposedHouse[] = [
  // ESTRAN: наследственная корона: титул по старшинству, корона подтверждает
  house({ id: "p-ashford", name: "Дом Ашфорд", stateId: "estran", seat: "Ашфордский замок над бродом", title: "графы", foundedYear: 612, founder: "Освин Ашфорд",
    originOfPower: "Получили брод и пошлину за поставки зерна короне в голодные годы.", inheritanceLaw: "Старший законный сын; при отсутствии сыновей: старшая дочь с согласия короны.",
    successionRule: "male-preference", headId: "ash-roland", motto: "Брод не ждёт", wealth: "comfortable", publicStanding: "Осторожный дом, всегда голосующий вместе с большинством совета.",
    members: [
      dead("ash-hugo", "Хьюго Ашфорд", 662, 731, "прежний граф", [], ["ash-clara"]),
      m("ash-clara", "Клара Ашфорд", 668, "вдовствующая графиня", [], ["ash-hugo"], "Фактически управляет финансами дома"),
      m("ash-roland", "Роланд Ашфорд", 694, "граф", ["ash-hugo", "ash-clara"], ["ash-adelina"]),
      m("ash-adelina", "Аделина из дома Фенвик", 699, "графиня", [], ["ash-roland"], "Дочь баронессы Мэйбл Фенвик"),
      m("ash-bertha", "Бренна Ашфорд", 721, "старшая дочь", ["ash-roland", "ash-adelina"]),
      m("ash-garet", "Гарет Ашфорд", 727, "наследник", ["ash-roland", "ash-adelina"], [], "Единственный сын; болезненный ребёнок"),
      m("ash-osvin", "Матис Ашфорд", 698, "младший брат графа", ["ash-hugo", "ash-clara"], [], "Командует бродовой стражей")
    ], cadetBranches: [], allies: ["valecourt"], rivals: ["dalen"], obligations: ["держать брод в порядке", "поставлять зерно в королевские амбары"],
    secrets: ["Вдовствующая графиня скрывает долг перед варентским банком."] }),
  house({ id: "p-fenwick", name: "Дом Фенвик", stateId: "estran", seat: "Фенвикские болота и солеварни", title: "бароны", foundedYear: 689, founder: "Мэйбл Фенвик",
    originOfPower: "Новый служилый дом: основательница получила титул за осушение болот.", inheritanceLaw: "Старший законный ребёнок независимо от пола (по жалованной грамоте 689 КЛ).",
    successionRule: "absolute-primogeniture", headId: "fen-mabel", motto: "Из воды: земля", wealth: "modest", publicStanding: "Старая знать считает их выскочками, крестьяне: справедливыми.",
    members: [
      m("fen-mabel", "Мэйбл Фенвик", 668, "баронесса, основательница", [], ["fen-uade"]),
      dead("fen-uade", "Уэйд Фенвик", 664, 719, "супруг основательницы", [], ["fen-mabel"], "Погиб при прорыве дамбы"),
      m("fen-rozamund", "Розамунда Фенвик", 692, "наследница", ["fen-mabel", "fen-uade"]),
      m("fen-tomas", "Томас Фенвик", 703, "младший сын", ["fen-mabel", "fen-uade"]),
      adopted("fen-linn", "Линн Фенвик", 718, "приёмная дочь", [], "Сирота с дамбы, принятая в дом по грамоте")
    ], cadetBranches: [], allies: ["p-ashford"], rivals: ["talren"], obligations: ["поддерживать дамбы", "платить соляной налог"],
    secrets: ["Дамба 719 КЛ прорвалась из-за сэкономленных на ремонте денег."] }),
  house({ id: "p-crow", name: "Дом Кроу", stateId: "estran", seat: "Вороний холм у Северного тракта", title: "рыцари короны", foundedYear: 730, founder: "Гарет Кроу",
    originOfPower: "Титул пожалован после Войны трёх вассалов за удержание тракта.", inheritanceLaw: "Рыцарское достоинство передаётся старшему сыну, если он примет присягу короне.",
    successionRule: "male-preference", headId: "crow-garet", motto: "Ждать и видеть", wealth: "poor", publicStanding: "Бедный, но храбрый дом; король доверяет им больше, чем знати.",
    members: [
      m("crow-garet", "Гарет Кроу", 701, "рыцарь короны, основатель", [], ["crow-bryanna"]),
      m("crow-bryanna", "Бренна Кроу", 706, "супруга", [], ["crow-garet"]),
      m("crow-edwin", "Эдрен Кроу", 726, "старший сын", ["crow-garet", "crow-bryanna"]),
      m("crow-ivy", "Ива Кроу", 729, "дочь", ["crow-garet", "crow-bryanna"]),
      ack("crow-bran", "Бран Кроу", 722, "признанный сын рыцаря", ["crow-garet"], "Рождён до брака; признан, но не наследует рыцарское достоинство")
    ], cadetBranches: [], allies: ["reynar"], rivals: ["morholt"], obligations: ["охранять участок Северного тракта"],
    secrets: [] }),

  // SAHRAD: султанат: патрилинейно, но совет колодцев и долги могут вмешаться
  house({ id: "p-haddad", name: "Дом Хаддад", stateId: "sahrad", seat: "Кузнечный квартал Кадиры", title: "амиры ремесленных цехов", foundedYear: 655, founder: "Хасан Хаддад",
    originOfPower: "Поднялись на оружии и медной утвари для султанского войска.", inheritanceLaw: "Старший сын; если сыновей нет: старший зять, принятый в дом.",
    successionRule: "male-preference", headId: "had-malik", motto: "Огонь кует верность", wealth: "great", publicStanding: "Богатый цеховой дом; при дворе их уважают, но в старых эмиратах морщатся.",
    members: [
      dead("had-hasan", "Хасан Хаддад", 630, 702, "основатель"),
      m("had-malik", "Малик ибн Хасан Хаддад", 676, "глава дома", ["had-hasan"], ["had-fatima"]),
      m("had-fatima", "Фатима бинт Идрис Азхар", 682, "супруга главы", [], ["had-malik"], "Происходит из соляного дома Азхар"),
      m("had-yasmin", "Ясмин бинт Малик Хаддад", 703, "старшая дочь", ["had-malik", "had-fatima"]),
      m("had-aisha", "Айша бинт Малик Хаддад", 708, "дочь", ["had-malik", "had-fatima"]),
      m("had-kasim", "Касим ибн Малик Хаддад", 716, "наследник", ["had-malik", "had-fatima"])
    ], cadetBranches: [], allies: ["azhar", "marun"], rivals: ["qadir"], obligations: ["поставлять оружие султанской гвардии"],
    secrets: ["Часть оружия уходит контрабандой в Тарвек."] }),
  house({ id: "p-wadi", name: "Дом аль-Вади", stateId: "sahrad", seat: "Долина Вади-Сафр", title: "хранители канала", foundedYear: 598, founder: "Сальма аль-Вади",
    originOfPower: "Род основательницы прорыл канал Вади-Сафр; совет колодцев доверил им распределение воды.",
    inheritanceLaw: "Хранителя канала избирают общины из потомков основательницы; дочь может быть избрана.",
    successionRule: "elective", headId: "wad-lubna", motto: "Вода для всех", wealth: "comfortable", publicStanding: "Самый почитаемый род долины; к ним идут судиться о воде.",
    members: [
      dead("wad-salim", "Салим аль-Вади", 655, 728, "прежний хранитель", [], ["wad-rima"]),
      m("wad-rima", "Рима аль-Вади", 660, "вдова хранителя", [], ["wad-salim"]),
      m("wad-lubna", "Лубна бинт Салим аль-Вади", 685, "хранительница канала", ["wad-salim", "wad-rima"], [], "Избрана в 728 КЛ вопреки старшему брату"),
      m("wad-idris", "Идрис ибн Салим аль-Вади", 682, "старший брат хранительницы", ["wad-salim", "wad-rima"], [], "Не смирился с выбором совета"),
      m("wad-nur", "Нур бинт Идрис аль-Вади", 712, "племянница", ["wad-idris"])
    ], cadetBranches: [], allies: ["sahra"], rivals: ["p-haddad"], obligations: ["делить воду по сезонному реестру"],
    secrets: [] }),
  house({ id: "p-zarraf", name: "Дом Зарраф", stateId: "sahrad", seat: "Медное побережье, порт Шаммар", title: "менялы и судовладельцы", foundedYear: 690, founder: "Саид Зарраф",
    originOfPower: "Разбогатели на обмене монет между Варентом и султанатом.", inheritanceLaw: "Имущество делится между сыновьями и дочерьми по закону, ведение дел получает назначенный главой.",
    successionRule: "testament", headId: "zar-said", motto: "Каждой монете: вес", wealth: "great", publicStanding: "Новые деньги; им должны половина портовых эмиров.",
    members: [
      m("zar-said", "Саид Зарраф", 668, "глава дома", [], ["zar-yara"]),
      m("zar-yara", "Яра Зарраф", 679, "супруга, ведёт книги", [], ["zar-said"]),
      m("zar-tarik", "Тарик ибн Саид Зарраф", 700, "старший сын", ["zar-said", "zar-yara"]),
      m("zar-amina", "Амина бинт Саид Зарраф", 704, "дочь", ["zar-said", "zar-yara"], [], "Лучший счётчик семьи"),
      foreign(m("zar-marco", "Марино Скали", 699, "компаньон из Варента", [], [], "Живёт в доме; родом из Варента"), "varent")
    ], cadetBranches: [], allies: ["house-merovar"], rivals: ["house-miraj"], obligations: ["платить портовую пошлину серебром"],
    secrets: ["Глава дома ещё не назвал наследника дела; сын и дочь соперничают."] }),

  // THARVEK: выборный Конклав: заслуга и испытание важнее крови
  house({ id: "p-kremen", name: "Дом Кремень", stateId: "tharvek", seat: "Кремнёвая застава", title: "князья заставы", foundedYear: 641, founder: "Радим Кремень",
    originOfPower: "Основатель удержал заставу в обвал 641 КЛ; Конклав дал роду землю.", inheritanceLaw: "Наследника выбирает Конклав из детей князя после испытания перевалом.",
    successionRule: "elective", headId: "kre-zdeslav", motto: "Не сдвинуть", wealth: "modest", publicStanding: "Суровый воинский дом, любимый гарнизонами.",
    members: [
      dead("kre-radim", "Радим Кремень", 615, 690, "основатель"),
      m("kre-zdeslav", "Здеслав Кремень", 675, "князь заставы", ["kre-radim"], ["kre-vesna"]),
      m("kre-vesna", "Весна Кремень", 680, "княгиня", [], ["kre-zdeslav"]),
      m("kre-velko", "Велько Кремень", 701, "старший сын", ["kre-zdeslav", "kre-vesna"], [], "Провалил первое испытание"),
      m("kre-zlata", "Злата Кремень", 704, "дочь", ["kre-zdeslav", "kre-vesna"], [], "Прошла испытание перевалом"),
      m("kre-goyko", "Гойко Кремень", 712, "младший сын", ["kre-zdeslav", "kre-vesna"])
    ], cadetBranches: [], allies: ["vark"], rivals: ["ashborn"], obligations: ["держать заставу открытой зимой"],
    secrets: [] }),
  house({ id: "p-rudnoy", name: "Дом Рудной", stateId: "tharvek", seat: "Рудные залы Велиграда", title: "старосты рудников", foundedYear: 580, founder: "Бранко Рудной",
    originOfPower: "Шахтёрская община выбрала род старостами; позже Конклав признал титул.", inheritanceLaw: "Староста избирается шахтёрским кругом из членов дома; круг может отозвать его.",
    successionRule: "council", headId: "rud-drag", motto: "Глубже: честнее", wealth: "comfortable", publicStanding: "Дом шахтёров: знать их не любит, общины поддерживают.",
    members: [
      m("rud-drag", "Драгана Рудная", 683, "староста рудников", [], ["rud-milan"]),
      dead("rud-milan", "Радим Скалич", 680, 733, "супруг старосты", [], ["rud-drag"], "Погиб в обвале"),
      m("rud-ruza", "Ружа Рудная", 706, "дочь", ["rud-drag", "rud-milan"]),
      m("rud-vedrana", "Ведрана Рудная", 709, "дочь", ["rud-drag", "rud-milan"]),
      adopted("rud-tor", "Тор Рудной", 720, "воспитанник", [], "Сын погибшего шахтёра, принят в дом")
    ], cadetBranches: [], allies: ["keld"], rivals: ["p-kremen"], obligations: ["отчитываться перед шахтёрским кругом"],
    secrets: ["Староста знает о трещине в главном штреке и тянет с закрытием."] }),
  house({ id: "p-gorach", name: "Дом Горач", stateId: "tharvek", seat: "Верхняя долина Горач", title: "лорды клятвенного зала", foundedYear: 512, founder: "Велько Горач",
    originOfPower: "Древний род хранителей клятв; их зал свидетельствует договоры между долинами.", inheritanceLaw: "Старшая линия, но наследник обязан принести Клятву Камня; клятвопреступник лишается права.",
    successionRule: "absolute-primogeniture", headId: "gor-mila", motto: "Слово тяжелее камня", wealth: "modest", publicStanding: "Старинный и гордый дом; им верят на слово.",
    members: [
      m("gor-mila", "Мила Горач", 671, "хранительница зала", [], ["gor-zdeslav"]),
      m("gor-zdeslav", "Здеслав Горач", 669, "супруг", [], ["gor-mila"]),
      m("gor-marek", "Марек Горач", 695, "наследник", ["gor-mila", "gor-zdeslav"], [], "Отказался приносить клятву до суда над братом"),
      m("gor-goran", "Горана Горач", 698, "дочь", ["gor-mila", "gor-zdeslav"]),
      m("gor-ivar", "Ивар Горач", 700, "младший сын", ["gor-mila", "gor-zdeslav"], [], "Обвинён в нарушении клятвы")
    ], cadetBranches: [], allies: ["dravik"], rivals: [], obligations: ["свидетельствовать договоры долин"],
    secrets: ["Обвинение младшего сына могло быть подстроено."] }),

  // VARENT: торговая лига: капитал по завещанию, место в Совете: по гражданству и доле
  house({ id: "p-cantarini", name: "Дом Кантарини", stateId: "varent", seat: "Палаццо у Стеклянной гавани", title: "банкиры Лиги", foundedYear: 655, founder: "Лоренцо Кантарини",
    originOfPower: "Банк, кредитующий половину судовладельцев Лиги.", inheritanceLaw: "Банк переходит по завещанию к одному наследнику; остальное делится поровну.",
    successionRule: "testament", headId: "can-beatris", motto: "Доверие: тоже капитал", wealth: "great", publicStanding: "Самый богатый банк Варента; каждый их брак: политическое событие.",
    members: [
      dead("can-lorenzo", "Лоренцо Кантарини", 640, 712, "основатель банка"),
      m("can-beatris", "Беатрис Кантарини", 678, "глава банка", ["can-lorenzo"], ["can-tiberio"]),
      m("can-tiberio", "Тиберио Кантарини", 674, "супруг, советник Лиги", [], ["can-beatris"]),
      m("can-ottavia", "Оттавия Кантарини", 702, "старшая дочь", ["can-beatris", "can-tiberio"]),
      m("can-nico", "Нико Кантарини", 705, "сын", ["can-beatris", "can-tiberio"], [], "Мечтает о море, а не о счетах"),
      m("can-flavia", "Флавия Кантарини", 713, "младшая дочь", ["can-beatris", "can-tiberio"])
    ], cadetBranches: [], allies: ["house-merovar"], rivals: ["sorell"], obligations: ["держать долю в общей казне Лиги"],
    secrets: ["Завещание не обнародовано; каждый из детей уверен, что наследник он."] }),
  house({ id: "p-oliviaro", name: "Дом Оливаро", stateId: "varent", seat: "Остров Скальный Рог", title: "капитаны-патриции", foundedYear: 702, founder: "Дарио Оливаро",
    originOfPower: "Бывший капитан, выкупивший гражданство и верфь.", inheritanceLaw: "Верфь достаётся тому из детей, кого утвердит совет капитанов острова.",
    successionRule: "council", headId: "oli-dario", motto: "Ветер платит смелым", wealth: "comfortable", publicStanding: "Новый дом, который старые фамилии терпят из-за его кораблей.",
    members: [
      m("oli-dario", "Дарио Оливаро", 680, "капитан-патриций", [], ["oli-marina"]),
      m("oli-marina", "Марина Оливаро", 690, "супруга, ведёт верфь", [], ["oli-dario"]),
      m("oli-pietro", "Пьетро Оливаро", 712, "сын", ["oli-dario", "oli-marina"], ["oli-mei"]),
      m("oli-silvana", "Сильвана Оливаро", 714, "дочь", ["oli-dario", "oli-marina"], [], "Ходит в море с отцом"),
      foreign(m("oli-mei", "Мэй Оливаро", 716, "невестка из Кхарума", [], ["oli-pietro"], "Родом из Кхарума; брак заключён ради торговли шёлком"), "kharum")
    ], cadetBranches: [], allies: ["lorent"], rivals: ["narel"], obligations: ["выставлять два корабля в общий флот"],
    secrets: [] }),
  house({ id: "p-tessari", name: "Дом Тессари", stateId: "varent", seat: "Квартал печатников Варенпорта", title: "нотарии и печатники", foundedYear: 618, founder: "Альвизе Тессари",
    originOfPower: "Печатают договоры Лиги и хранят копии реестров.", inheritanceLaw: "Наследник обязан сдать экзамен коллегии нотариев; без экзамена: только доля имущества.",
    successionRule: "council", headId: "tes-severo", motto: "Записано: значит было", wealth: "modest", publicStanding: "Им доверяют бумаги, но не секреты.",
    members: [
      m("tes-severo", "Северо Тессари", 672, "глава коллегии дома", [], ["tes-julia"]),
      m("tes-julia", "Джулия Тессари", 676, "супруга", [], ["tes-severo"]),
      m("tes-kiara", "Кьяра Тессари", 699, "старшая дочь, нотарий", ["tes-severo", "tes-julia"]),
      m("tes-alvise", "Нико Тессари", 704, "сын", ["tes-severo", "tes-julia"], [], "Дважды провалил экзамен"),
      ack("tes-dario", "Дарио Тессари", 701, "признанный сын главы", ["tes-severo"], "Мать: служанка дома; признан нотариально")
    ], cadetBranches: [], allies: ["vell"], rivals: [], obligations: ["хранить копии договоров Совета"],
    secrets: ["В архиве дома лежит подложный договор, о котором знает только глава."] }),

  // ELYNDOR: лига общин: право ограничено общинным договором, наследника утверждает круг
  house({ id: "p-ryabin", name: "Род Рябин", stateId: "elyndor", seat: "Рябиновый круг у Летариэля", title: "старшие круга", foundedYear: 470, founder: "Сейни Рябин",
    originOfPower: "Один из родов, первыми заключивших договор о лесных тропах.", inheritanceLaw: "Старшинство переходит к тому, кого назовёт круг рода; пол и порядок рождения не решают.",
    successionRule: "council", headId: "rya-kaisa", motto: "Лес помнит долги", wealth: "modest", publicStanding: "Почтенный род; к их слову прислушивается Совет Старших Рощ.",
    members: [
      m("rya-kaisa", "Кайса Рябин", 668, "старшая круга", [], ["rya-ilmar"]),
      m("rya-ilmar", "Ильмар Рябин", 664, "супруг, следопыт", [], ["rya-kaisa"]),
      m("rya-lauri", "Лаури Рябин", 690, "сын", ["rya-kaisa", "rya-ilmar"]),
      m("rya-iine", "Иинэ Рябин", 694, "дочь, целительница", ["rya-kaisa", "rya-ilmar"]),
      m("rya-veiko", "Вейко Рябин", 718, "внук", ["rya-lauri"])
    ], cadetBranches: [], allies: ["aelthir"], rivals: ["lareth"], obligations: ["охранять Рябиновую тропу"],
    secrets: [] }),
  house({ id: "p-kamyshov", name: "Род Камышов", stateId: "elyndor", seat: "Камышовая гать на Северном озере", title: "озёрные перевозчики", foundedYear: 610, founder: "Ханно Камышов",
    originOfPower: "Держат все лодочные переправы северного озера.", inheritanceLaw: "Переправы делятся между детьми; старшего перевозчика выбирает озёрный сход.",
    successionRule: "elective", headId: "kam-tuviya", motto: "Довезём", wealth: "comfortable", publicStanding: "Богатый, но не знатный род; их уважают за честность цен.",
    members: [
      m("kam-tuviya", "Тувия Камышова", 680, "старший перевозчик", [], ["kam-aert"]),
      m("kam-aert", "Аэрт Камышов", 677, "супруг", [], ["kam-tuviya"]),
      m("kam-riena", "Риэна Камышова", 703, "дочь", ["kam-tuviya", "kam-aert"]),
      m("kam-vein", "Вейн Камышов", 706, "сын", ["kam-tuviya", "kam-aert"]),
      m("kam-ilva", "Ильва Камышова", 710, "дочь", ["kam-tuviya", "kam-aert"])
    ], cadetBranches: [], allies: ["willow"], rivals: [], obligations: ["перевозить хранителей рощ бесплатно"],
    secrets: [] }),
  house({ id: "p-olkhovy", name: "Род Ольховый", stateId: "elyndor", seat: "Ольховые вырубки", title: "лесничие", foundedYear: 688, founder: "Вейко Ольховый",
    originOfPower: "Получили право рубки по договору 688 КЛ; многие общины считают договор несправедливым.", inheritanceLaw: "Право рубки не наследуется само: каждый новый глава подтверждает договор у Совета Рощ.",
    successionRule: "council", headId: "olk-hanno", motto: "Дерево за дерево", wealth: "comfortable", publicStanding: "Лесорубы и торговцы древесиной; хранители рощ им не доверяют.",
    members: [
      dead("olk-veiko", "Вейко Ольховый", 655, 724, "основатель"),
      m("olk-hanno", "Ханно Ольховый", 684, "глава рода", ["olk-veiko"], ["olk-siel"]),
      m("olk-siel", "Сиэль Ольховая", 690, "супруга", [], ["olk-hanno"]),
      m("olk-teivo", "Тейво Ольховый", 712, "сын", ["olk-hanno", "olk-siel"]),
      foreign(m("olk-claire", "Клара Хейл", 692, "управляющая из Эстрана", [], [], "Родом из Эстрана, ведёт продажу леса"), "estran")
    ], cadetBranches: [], allies: [], rivals: ["sylvar", "p-ryabin"], obligations: ["сажать два дерева за каждое срубленное"],
    secrets: ["Род рубит в запретной роще и платит хранителю за молчание."] }),

  // KHARUM: империя: наследника утверждает указ, а должность: экзамен
  house({ id: "p-han", name: "Дом Хань", stateId: "kharum", seat: "Южная провинция Хань-Лу", title: "наместники", foundedYear: 512, founder: "Хань Шэн",
    originOfPower: "Наместничество, подтверждаемое каждым новым императором.", inheritanceLaw: "Император назначает наместника; обычно старшего сына, сдавшего экзамен.",
    successionRule: "appointment", headId: "han-lyang", motto: "Порядок: опора неба", wealth: "great", publicStanding: "Сильнейший провинциальный дом; двор опасается их самостоятельности.",
    members: [
      dead("han-hao", "Хань Хао", 655, 726, "прежний наместник"),
      m("han-lyang", "Хань Лян", 684, "наместник", ["han-hao"], ["han-qing"]),
      m("han-qing", "Цзян Цин", 688, "супруга наместника", [], ["han-lyang"], "Из рода Цзян"),
      m("han-bo", "Хань Бо", 707, "старший сын", ["han-lyang", "han-qing"], [], "Не сдал столичный экзамен"),
      m("han-xue", "Хань Сюэ", 710, "дочь", ["han-lyang", "han-qing"], [], "Первая на экзамене в провинции"),
      m("han-ming", "Хань Минь", 715, "младший сын", ["han-lyang", "han-qing"])
    ], cadetBranches: [], allies: ["qamar"], rivals: ["linhai"], obligations: ["платить зерновой налог", "выставлять войска по указу"],
    secrets: ["Наместник утаивает часть налога под видом разлива реки."] }),
  house({ id: "p-mo", name: "Дом Мо", stateId: "kharum", seat: "Мастерские фарфора у Хар-Кадара", title: "мастера императорских печей", foundedYear: 401, founder: "Мо Юань",
    originOfPower: "Поставщики фарфора двора с основания империи.", inheritanceLaw: "Печи наследует лучший мастер семьи по решению семейного совета; указ двора лишь подтверждает.",
    successionRule: "council", headId: "mo-rong", motto: "Огонь не лжёт", wealth: "comfortable", publicStanding: "Ремесленный дом, ценимый двором выше многих аристократов.",
    members: [
      m("mo-rong", "Мо Жун", 670, "глава печей", [], ["mo-tang"]),
      m("mo-tang", "Тан Ли", 668, "супруг", [], ["mo-rong"]),
      m("mo-nin", "Мо Нин", 694, "дочь, мастер", ["mo-rong", "mo-tang"]),
      m("mo-shen", "Мо Шэн", 697, "сын", ["mo-rong", "mo-tang"]),
      adopted("mo-yao", "Мо Яо", 712, "ученица, принятая в дом", [], "Лучшая ученица печей")
    ], cadetBranches: [], allies: ["severan"], rivals: [], obligations: ["поставлять фарфор к праздникам двора"],
    secrets: [] }),
  house({ id: "p-gu", name: "Дом Гу", stateId: "kharum", seat: "Почтовая станция Девяти Дорог", title: "смотрители имперской почты", foundedYear: 560, founder: "Гу Сун",
    originOfPower: "Управляют почтовыми станциями северного тракта.", inheritanceLaw: "Должность не наследуется: кандидата из семьи выдвигают, но назначает писцовая палата.",
    successionRule: "appointment", headId: "gu-fen", motto: "Весть приходит вовремя", wealth: "modest", publicStanding: "Им известны все новости империи раньше двора.",
    members: [
      m("gu-fen", "Гу Фэн", 676, "главный смотритель", [], ["gu-hua"]),
      m("gu-hua", "Бай Хуа", 680, "супруга", [], ["gu-fen"]),
      m("gu-yu", "Гу Юй", 703, "дочь, писец", ["gu-fen", "gu-hua"]),
      m("gu-sheng", "Гу Шэн", 706, "сын, гонец", ["gu-fen", "gu-hua"]),
      foreign(m("gu-farid", "Фарид аль-Бир", 690, "почтовый агент из Сахрада", [], [], "Родом из Сахрада, живёт на станции"), "sahrad")
    ], cadetBranches: [], allies: ["house-azrakar"], rivals: ["shuren"], obligations: ["доставлять указы в срок"],
    secrets: ["Смотритель читает чужие письма и продаёт сведения."] })
];
