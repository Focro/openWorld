/**
 * Духовенство шести традиций Ардана (0.14.0) — ПРЕДЛОЖЕНИЕ ПРОЕКТА.
 *
 * Основа — канонические описания вер (faiths.ts → clergyStructure, politicalRole).
 * Здесь добавлены названия должностей, порядок их замещения, резиденции и поимённые
 * высшие служители. Канонические ограничения соблюдены:
 *  - у Памяти Зелёных Рощ нет единого верховного духовного лица;
 *  - коллегия Открытого Фонаря не является церковной иерархией;
 *  - собрание Клятвы Камня согласует правила, но не командует князьями;
 *  - Первый светоч Солнечного Канона утверждается двором.
 * Автор мира может переименовать или заменить любую должность и любое имя.
 */
import type { AppearanceProfile } from "./heritage";
import { sampleNativeAppearance, type StateId } from "./populations";

export interface ClergyRank {
  /** Название должности, как его произносят в стране. */
  title: string;
  /** 1 — местный уровень, выше — старше. */
  level: number;
  duties: string;
  howChosen: string;
}
export interface ClergyPerson {
  id: string;
  name: string;
  rankTitle: string;
  seat: string;
  birthYear: number;
  /** Кратко: характер и как человек ведёт себя на должности. */
  temperament: string;
  /** Публичная позиция: что о нём знают люди. Тайн здесь нет. */
  publicStance: string;
}
export interface FaithInstitution {
  faithId: string;
  stateId: StateId;
  governingBody: string;
  /** Глава или председательствующий; у Памяти Зелёных Рощ его нет по канону. */
  presidingId?: string;
  seat: string;
  ranks: ClergyRank[];
  persons: ClergyPerson[];
  relationToPower: string;
  provenance: "proposal";
}

export const FAITH_INSTITUTIONS: FaithInstitution[] = [
  {
    faithId: "sevenfold", stateId: "estran", provenance: "proposal",
    governingBody: "Великий собор Первого Огня", presidingId: "cl-sev-hilda", seat: "Собор Первого Огня в Коронхольме",
    relationToPower: "Венчает монархов и ведёт поминальные книги, но не входит в королевскую семью и не правит землями.",
    ranks: [
      { title: "служитель очага", level: 1, duties: "ведёт местный храм, имянаречение и поминовение", howChosen: "назначается настоятелем после обучения" },
      { title: "наставник света", level: 2, duties: "учит грамоте и толкованию в храмовой школе", howChosen: "избирается советом храма из служителей" },
      { title: "настоятель", level: 3, duties: "управляет несколькими храмами, приютами и школами округа", howChosen: "назначается соборными хранителями" },
      { title: "соборный хранитель", level: 4, duties: "голосует в Великом соборе по вопросам догмата", howChosen: "избирается настоятелями своей земли" },
      { title: "Первосвечник", level: 5, duties: "председательствует в Великом соборе, зажигает Первый огонь при коронации", howChosen: "избирается собором пожизненно; корона не утверждает" }
    ],
    persons: [
      { id: "cl-sev-hilda", name: "Хильда Освин", rankTitle: "Первосвечник", seat: "Коронхольм", birthYear: 669, temperament: "строгая, терпеливая, не терпит показной набожности", publicStance: "Требует, чтобы приюты финансировались до налога на мосты." },
      { id: "cl-sev-matis", name: "Матис Бартон", rankTitle: "соборный хранитель", seat: "Ровен", birthYear: 688, temperament: "мягкий и уступчивый, хороший примиритель", publicStance: "Защищает городские хартии перед советом короны." },
      { id: "cl-sev-adela", name: "Адела Линдел", rankTitle: "настоятель", seat: "Миллфорд", birthYear: 701, temperament: "деятельная, резкая, любима бедняками", publicStance: "Открыла три новых приюта после голодного года." }
    ]
  },
  {
    faithId: "path_of_wells", stateId: "sahrad", provenance: "proposal",
    governingBody: "Совет старших источников", presidingId: "cl-wel-idris", seat: "Колодезный дом Кадиры",
    relationToPower: "Султан не назначает хранителей воды; совет может осудить эмира за отравление или захват колодца.",
    ranks: [
      { title: "хранитель источника", level: 1, duties: "следит за чистотой и очередью воды", howChosen: "избирается общиной колодца" },
      { title: "наставник дороги", level: 2, duties: "сопровождает караваны, учит обычаю воды путнику", howChosen: "посвящается советом после трёх караванных лет" },
      { title: "кади колодцев", level: 3, duties: "судит споры о воде и долгах", howChosen: "избирается советом из наставников" },
      { title: "старший источник", level: 4, duties: "представляет оазис в совете", howChosen: "избирается кади своего пояса" },
      { title: "Шейх аль-Аюн (Старейший колодцев)", level: 5, duties: "председатель совета, хранитель Свода Водных Обязанностей", howChosen: "старейший по посвящению член совета; можно отвести голосованием" }
    ],
    persons: [
      { id: "cl-wel-idris", name: "Идрис ибн Юсуф аль-Кади", rankTitle: "Шейх аль-Аюн (Старейший колодцев)", seat: "Кадира", birthYear: 664, temperament: "медлительный, точный, говорит притчами", publicStance: "Публично упрекнул султанский двор за пошлину на воду." },
      { id: "cl-wel-salma", name: "Сальма бинт Касим Наххас", rankTitle: "кади колодцев", seat: "Сафра", birthYear: 692, temperament: "прямая, неподкупная, резкая с богатыми", publicStance: "Решила спор о колодце против дома Кадир." },
      { id: "cl-wel-hasan", name: "Хасан ибн Малик аль-Мельх", rankTitle: "наставник дороги", seat: "соляные дороги", birthYear: 705, temperament: "весёлый, общительный, знает все караваны", publicStance: "Сопровождает соляные караваны и обучает молодых погонщиков." }
    ]
  },
  {
    faithId: "open_lantern", stateId: "varent", provenance: "proposal",
    governingBody: "Коллегия Фонаря (не церковная иерархия)", presidingId: "cl-lan-chiara", seat: "Дом Свидетельств в Варенпорте",
    relationToPower: "Коллегия заверяет договоры Лиги и ведёт школы; приказывать гражданам и Совету она не может.",
    ranks: [
      { title: "чтец свидетельств", level: 1, duties: "ведёт публичные чтения и записи", howChosen: "сдаёт экзамен дома учёных" },
      { title: "магистр школы", level: 2, duties: "учит счёту, навигации и праву", howChosen: "избирается учениками и магистрами школы" },
      { title: "старший нотарий", level: 3, duties: "проверяет подлинность документов", howChosen: "назначается коллегией после аттестации" },
      { title: "проктор коллегии", level: 4, duties: "представляет город в коллегии", howChosen: "избирается старшими нотариями города" },
      { title: "Первый свидетель", level: 5, duties: "председатель коллегии на три года, открывает публичные диспуты", howChosen: "избирается проктором на три года, без права подряд" }
    ],
    persons: [
      { id: "cl-lan-chiara", name: "Кьяра Малверди", rankTitle: "Первый свидетель", seat: "Варенпорт", birthYear: 690, temperament: "ироничная, блестящий спорщик, любит неудобные вопросы", publicStance: "Требует открыть реестр долгов Лиги." },
      { id: "cl-lan-severo", name: "Северо Дзенон", rankTitle: "проктор коллегии", seat: "Варенпорт", birthYear: 672, temperament: "осторожный, педантичный", publicStance: "Защищает тайну частных договоров." },
      { id: "cl-lan-oto", name: "Оттавия Бруно", rankTitle: "магистр школы", seat: "островная школа навигаторов", birthYear: 708, temperament: "увлечённая, нетерпеливая с ленивыми", publicStance: "Учит навигации детей без гражданства." }
    ]
  },
  {
    faithId: "stone_oath", stateId: "tharvek", provenance: "proposal",
    governingBody: "Собрание старших камней", presidingId: "cl-sto-gojko", seat: "Зал Клятв в Драворне",
    relationToPower: "Свидетельствует клятвы и договоры Конклава; не командует князьями, но может объявить клятвопреступника.",
    ranks: [
      { title: "хранитель камня", level: 1, duties: "ведёт обряды рода у родового камня", howChosen: "назначается родом" },
      { title: "свидетель перевала", level: 2, duties: "подтверждает договоры и межевые знаки", howChosen: "избирается долиной" },
      { title: "кузнец клятвы", level: 3, duties: "куёт обрядовые предметы и хранит клятвенные кольца", howChosen: "наследственно в кузнечных домах, подтверждается собранием" },
      { title: "старший камень", level: 4, duties: "член собрания от своей долины", howChosen: "избирается свидетелями перевала долины" },
      { title: "Голос Камня", level: 5, duties: "оглашает решения собрания и принимает клятву верховного хранителя перевалов", howChosen: "избирается собранием на срок одного Конклава" }
    ],
    persons: [
      { id: "cl-sto-gojko", name: "Гойко Камнев", rankTitle: "Голос Камня", seat: "Драворн", birthYear: 676, temperament: "суровый, немногословный, никогда не нарушал слова", publicStance: "Отказался свидетельствовать договор, заключённый под угрозой." },
      { id: "cl-sto-vesna", name: "Весна Скалич", rankTitle: "старший камень", seat: "Верхние долины", birthYear: 694, temperament: "упрямая и справедливая", publicStance: "Требует суда над клятвопреступниками из знатных домов наравне с простыми." },
      { id: "cl-sto-velko", name: "Велько Железняк", rankTitle: "кузнец клятвы", seat: "рудники Велиграда", birthYear: 700, temperament: "тихий мастер, верит больше делу, чем словам", publicStance: "Куёт кольца для клятв шахтёрских кругов." }
    ]
  },
  {
    faithId: "green_memory", stateId: "elyndor", provenance: "proposal",
    governingBody: "Родовые круги и Встреча песенных хранителей (единого главы нет)", seat: "Старшая роща у Летариэля",
    relationToPower: "Хранители рощ дают согласие на рубку и охоту по общинным договорам; приказывать Совету Старших Рощ не могут.",
    ranks: [
      { title: "песенный хранитель", level: 1, duties: "помнит родовые имена, поёт песни памяти", howChosen: "ученичество у старшего хранителя рода" },
      { title: "хранитель рощи", level: 2, duties: "отвечает за конкретную рощу или источник", howChosen: "назначается родовым кругом места" },
      { title: "целитель-травник", level: 2, duties: "лечит и передаёт знание о травах", howChosen: "признаётся кругом после ученичества" },
      { title: "старший голос круга", level: 3, duties: "ведёт обсуждение в родовом круге, но решает круг", howChosen: "избирается кругом на зиму, может избираться снова" }
    ],
    persons: [
      { id: "cl-grn-iine", name: "Иинэ Озерная", rankTitle: "старший голос круга", seat: "Летариэль", birthYear: 671, temperament: "спокойная, слушает дольше, чем говорит", publicStance: "Созывает Встречу хранителей, когда спорят о вырубках." },
      { id: "cl-grn-tir", name: "Тир Мшистый", rankTitle: "хранитель рощи", seat: "Старшая роща", birthYear: 688, temperament: "недоверчивый к чужакам, преданный месту", publicStance: "Не пускает лесорубов в старшую рощу." },
      { id: "cl-grn-kaisa", name: "Кайса Брусничная", rankTitle: "целитель-травник", seat: "озёрные деревни", birthYear: 706, temperament: "тёплая, говорливая, бесстрашная у постели больного", publicStance: "Лечит и общинников, и приезжих без разбора." }
    ]
  },
  {
    faithId: "imperial_sun", stateId: "kharum", provenance: "proposal",
    governingBody: "Палата Солнечного Порядка", presidingId: "cl-sun-yuan", seat: "Храм Полуденного Света в Хар-Кадаре",
    relationToPower: "Первого светоча утверждает двор, но писцы канона вправе спорить с указом, если он противоречит закону.",
    ranks: [
      { title: "служитель святилища", level: 1, duties: "ведёт местные обряды и календарь", howChosen: "сдаёт уездный экзамен канона" },
      { title: "толкователь канона", level: 2, duties: "толкует тексты и право", howChosen: "сдаёт провинциальный экзамен" },
      { title: "старший писец", level: 3, duties: "ведёт архив и школу святилища", howChosen: "назначается палатой по итогам столичного экзамена" },
      { title: "хранитель порядка провинции", level: 4, duties: "координирует святилища провинции и надзирает за календарём", howChosen: "назначается палатой, утверждается наместником" },
      { title: "Первый светоч", level: 5, duties: "высшее церемониальное лицо, ведёт обряд солнцестояния при императоре", howChosen: "выдвигается палатой, утверждается указом двора" }
    ],
    persons: [
      { id: "cl-sun-yuan", name: "Тан Юань", rankTitle: "Первый светоч", seat: "Хар-Кадар", birthYear: 667, temperament: "церемонный, хитрый, превосходный каллиграф", publicStance: "Ведёт календарь двора и сдерживает спор палаты с наместниками." },
      { id: "cl-sun-xia", name: "Сун Ся", rankTitle: "хранитель порядка провинции", seat: "Великая дельта", birthYear: 689, temperament: "честолюбивая и неподкупная", publicStance: "Открыто оспорила указ о налоге в год разлива." },
      { id: "cl-sun-bo", name: "Лю Бо", rankTitle: "старший писец", seat: "архив Хар-Кадара", birthYear: 702, temperament: "застенчивый, с феноменальной памятью", publicStance: "Восстановил утраченные главы Реестра Разливов." }
    ]
  }
];

export const institutionForFaith = (faithId: string): FaithInstitution | undefined => FAITH_INSTITUTIONS.find(f => f.faithId === faithId);
export const clergyPersonById = (id: string): (ClergyPerson & { faithId: string; stateId: StateId }) | undefined => {
  for (const inst of FAITH_INSTITUTIONS) {
    const p = inst.persons.find(x => x.id === id);
    if (p) return { ...p, faithId: inst.faithId, stateId: inst.stateId };
  }
  return undefined;
};
/** Внешность служителя — облик его страны (populations.ts), стабильная по id. */
export const clergyAppearance = (id: string): AppearanceProfile | undefined => {
  const p = clergyPersonById(id);
  return p ? sampleNativeAppearance(p.stateId, `clergy:${id}`) : undefined;
};
