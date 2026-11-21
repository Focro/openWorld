/**
 * Королевский двор Рейнаров в Коронхольме: дворцовые локации, члены семьи как NPC,
 * их расписания по возрасту и хронология кампании второго принца.
 *
 * Канон (см. docs/veloria и nobleHouses.ts): Альдрен: 722 КЛ, второй принц: 723 КЛ,
 * Марен: 724 КЛ, Элиза: 726 КЛ, Орен: 727 КЛ, смерть матери второго принца: 725 КЛ
 * (причина не установлена), Элиана III становится королевой в 735 КЛ.
 *
 * Канон фиксирует только ГОДЫ. Точные дни внутри года: проектное допущение
 * (provenance: "canon-date-assumed"), а не канонический факт.
 */
import type { LocationDef, NpcDef, ScheduleEntry, ScheduledWorldEvent } from "../../engine/types";
import { createAppearanceState } from "../../engine/appearance";
import { instantiateUpperSocietyNpc } from "./upperSociety";

export const SECOND_PRINCE_START_YEAR = 723;
const DAY = 1440;
const YEAR = 365 * DAY;
/** Абсолютная минута для года КЛ и дня года (1..365) в шкале кампании, начинающейся с startYearKL. */
export const minuteOfKL = (yearKL: number, dayOfYear: number, startYearKL: number, minuteOfDay = 12 * 60) =>
  ((yearKL - startYearKL) * 365 + (dayOfYear - 1)) * DAY + minuteOfDay;

/** Проектные дни рождения внутри канонических годов. Изменяются здесь, а не по коду. */
export const REYNAR_ASSUMED_BIRTH_DAYS: Record<string, { year: number; day: number }> = {
  "rey-first-prince": { year: 722, day: 100 },
  "rey-second-prince": { year: 723, day: 1 },
  "rey-maren": { year: 724, day: 140 },
  "rey-fourth-princess": { year: 726, day: 200 },
  "rey-oren": { year: 727, day: 250 }
};

export const PALACE_LOCATIONS: LocationDef[] = [
  { id: "rey:royal-nursery", name: "Коронхольм, королевская детская", description: "Тихая комната во внутреннем крыле дворца. Здесь находятся дети королевского дома и их воспитатели.", exits: [{ to: "rey:royal-corridor", distanceM: 25, terrain: "street" }] },
  { id: "rey:royal-chamber", name: "Коронхольм, покои королевской семьи", description: "Частные покои Элианы и Гарена. Семейные разногласия скрываются за придворным этикетом.", exits: [{ to: "rey:royal-corridor", distanceM: 30, terrain: "street" }] },
  { id: "rey:royal-corridor", name: "Коронхольм, внутренний коридор", description: "Коридор соединяет детскую, покои семьи, классную комнату и внутренний двор. Стража следит, кто проходит дальше.", exits: [{ to: "rey:royal-nursery", distanceM: 25, terrain: "street" }, { to: "rey:royal-chamber", distanceM: 30, terrain: "street" }, { to: "rey:schoolroom", distanceM: 40, terrain: "street" }, { to: "rey:palace-courtyard", distanceM: 60, terrain: "street" }] },
  // Проектная локация 0.13.0: место уроков детей двора. Не меняет канон дворца, только детализирует его.
  { id: "rey:schoolroom", name: "Коронхольм, классная комната", description: "Светлая комната с картами, грифельными досками и полками книг. Здесь детей двора учат грамоте, счёту, истории и этикету.", exits: [{ to: "rey:royal-corridor", distanceM: 40, terrain: "street" }] },
  { id: "rey:palace-courtyard", name: "Коронхольм, внутренний двор", description: "Закрытый двор между жилым крылом и главными воротами. Отсюда можно попасть к городской площади.", exits: [{ to: "rey:royal-corridor", distanceM: 60, terrain: "street" }, { to: "atlas:koronholm:square", distanceM: 180, terrain: "street" }] }
];

const NURSERY = "rey:royal-nursery", CHAMBER = "rey:royal-chamber", SCHOOL = "rey:schoolroom", COURTYARD = "rey:palace-courtyard";

/** Как живут дети двора в разном возрасте. Проектная модель распорядка, не канон. */
export const ROYAL_CHILD_SCHEDULES: Array<{ fromAgeYears: number; schedule: ScheduleEntry[] }> = [
  { fromAgeYears: 0, schedule: [{ from: 0, to: 24, locationId: NURSERY, activity: "спит, ест и находится под присмотром нянь" }] },
  { fromAgeYears: 3, schedule: [
    { from: 0, to: 11, locationId: NURSERY, activity: "спит или играет в детской под присмотром нянь" },
    { from: 11, to: 13, locationId: COURTYARD, activity: "гуляет во внутреннем дворе с нянями" },
    { from: 13, to: 24, locationId: NURSERY, activity: "играет и отдыхает в детской" }
  ] },
  { fromAgeYears: 7, schedule: [
    { from: 0, to: 8, locationId: NURSERY, activity: "спит в детском крыле" },
    { from: 8, to: 13, locationId: SCHOOL, activity: "занимается с наставниками" },
    { from: 13, to: 16, locationId: COURTYARD, activity: "упражняется и гуляет во внутреннем дворе" },
    { from: 16, to: 24, locationId: NURSERY, activity: "проводит вечер в детском крыле" }
  ] },
  { fromAgeYears: 16, schedule: [
    { from: 0, to: 8, locationId: CHAMBER, activity: "отдыхает в личных покоях" },
    { from: 8, to: 12, locationId: SCHOOL, activity: "занимается с наставниками и советниками" },
    { from: 12, to: 20, locationId: COURTYARD, activity: "участвует в придворной жизни" },
    { from: 20, to: 24, locationId: CHAMBER, activity: "проводит вечер в покоях" }
  ] }
];

export interface ReynarCourt { npcs: Record<string, NpcDef>; locations: Record<string, LocationDef>; events: ScheduledWorldEvent[] }

function courtChild(id: string, startYearKL: number): NpcDef | null {
  const birth = REYNAR_ASSUMED_BIRTH_DAYS[id];
  const npc = instantiateUpperSocietyNpc(id, NURSERY, ROYAL_CHILD_SCHEDULES[0]!.schedule);
  if (!npc || !birth) return npc;
  return { ...npc, bornAtMinute: minuteOfKL(birth.year, birth.day, startYearKL, 6 * 60), lifeSchedules: structuredClone(ROYAL_CHILD_SCHEDULES) };
}

/**
 * Собирает двор. Если игрок: второй принц, его NPC-версия НЕ создаётся,
 * а младшие дети рождаются по ходу кампании через запланированные события.
 */
export function buildReynarCourt(playerIsSecondPrince: boolean, startYearKL: number): ReynarCourt {
  const locations = Object.fromEntries(PALACE_LOCATIONS.map(location => [location.id, structuredClone(location)]));
  const npcs: Record<string, NpcDef> = {};
  const events: ScheduledWorldEvent[] = [];

  const elin = instantiateUpperSocietyNpc("rey-elin", CHAMBER, playerIsSecondPrince ? [
    { from: 6, to: 8, locationId: CHAMBER, activity: "готовится к семейным и придворным делам" },
    { from: 8, to: 9, locationId: NURSERY, activity: "навещает своих детей в детской; со вторым принцем держится подчёркнуто холодно" },
    { from: 9, to: 22, locationId: CHAMBER, activity: "занимается семейными и придворными делами" }
  ] : [{ from: 0, to: 24, locationId: CHAMBER, activity: "занимается семейными и придворными делами" }]);
  if (elin) npcs[elin.id] = { ...elin, caregiving: playerIsSecondPrince ? { role: "relative", canFeed: false } : undefined };

  const garen = instantiateUpperSocietyNpc("rey-consort", CHAMBER, playerIsSecondPrince ? [
    { from: 7, to: 8, locationId: CHAMBER, activity: "готовится к семейным делам" },
    { from: 8, to: 10, locationId: NURSERY, activity: "навещает детей, особенно второго сына" },
    { from: 10, to: 22, locationId: CHAMBER, activity: "находится при семье и дворе" }
  ] : [{ from: 0, to: 24, locationId: CHAMBER, activity: "находится при семье и дворе" }]);
  if (garen) npcs[garen.id] = {
    ...garen,
    caregiving: playerIsSecondPrince ? { role: "father", canFeed: false } : undefined,
    appearance: createAppearanceState({ skinTone: 2, naturalHairColor: "light-blond", hairTexture: "wavy", eyeColor: "grey", facialFeatures: "angular" }, { hairstyle: "короткая волнистая причёска", clothing: "одежда королевского двора" })
  };

  const childIds = playerIsSecondPrince
    ? ["rey-first-prince", "rey-maren", "rey-fourth-princess", "rey-oren"]
    : ["rey-first-prince", "rey-second-prince", "rey-maren", "rey-fourth-princess", "rey-oren"];
  for (const id of childIds) {
    const child = courtChild(id, startYearKL);
    if (child) npcs[id] = child;
  }
  const second = npcs["rey-second-prince"];
  if (second) second.appearance = createAppearanceState({ skinTone: 3, naturalHairColor: "light-blond", hairTexture: "straight", eyeColor: "dark-brown", facialFeatures: "east-asian" }, { hairstyle: "короткая аккуратная причёска", clothing: "одежда второго принца" });

  if (playerIsSecondPrince) {
    npcs["rey-second-prince-mother"] = {
      id: "rey-second-prince-mother", name: "Женщина из далёкой восточной земли", homeId: NURSERY, age: 22, birthYear: 701, lifeStatus: "alive", familyRole: "biological-parent",
      caregiving: { role: "mother", canFeed: true },
      appearance: createAppearanceState({ skinTone: 5, naturalHairColor: "black", hairTexture: "straight", eyeColor: "dark-brown", facialFeatures: "east-asian" }, { hairstyle: "длинные волосы, собранные назад", clothing: "простое платье при дворце" }),
      roleTags: ["commoner"],
      goals: ["быть рядом с новорождённым сыном", "сохранить его безопасность", "не допустить, чтобы придворный конфликт коснулся ребёнка"],
      personality: { temperament: "осторожная, наблюдательная, сдержанная из-за жизни при дворе и неизвестного прошлого", traits: { warmth: 78, sociability: 35, assertiveness: 47, emotionalReactivity: 58, patience: 74, openness: 31, discipline: 70, suspicion: 72, empathy: 82, pride: 54 }, values: ["безопасность ребёнка", "личная свобода", "молчание о прошлом"], formativeExperiences: ["Прибыла из далёкой восточной земли; детали её прежней жизни и имя не подтверждены."], copingPatterns: ["не рассказывает о прошлом без доверия", "держит ребёнка рядом, когда при дворе напряжённо"], initialHabits: [{ id: "mother-watches-child", label: "проверяет дыхание и сон младенца", trigger: "ночь и пробуждение", strength: 92 }] },
      schedule: [{ from: 0, to: 24, locationId: NURSERY, activity: "находится рядом с сыном" }]
    };
    npcs["rey-second-prince-nurse"] = {
      id: "rey-second-prince-nurse", name: "Мейра, королевская кормилица", homeId: NURSERY, age: 43, birthYear: 680, lifeStatus: "alive", familyRole: "guardian", roleTags: ["commoner"],
      caregiving: { role: "wet-nurse", canFeed: true },
      goals: ["обеспечивать уход за младенцем", "не допускать конфликтов взрослых рядом с ребёнком"],
      personality: { temperament: "спокойная, практичная и решительная в вопросах безопасности младенца", traits: { warmth: 84, sociability: 42, assertiveness: 68, emotionalReactivity: 26, patience: 93, openness: 48, discipline: 91, suspicion: 58, empathy: 90, pride: 43 }, values: ["здоровье ребёнка", "порядок", "бережный уход"], formativeExperiences: ["Много лет служит при королевском доме и умеет сохранять спокойствие в напряжённой обстановке."], copingPatterns: ["пресекает ссоры рядом с младенцем", "сначала проверяет потребности ребёнка"], initialHabits: [{ id: "nurse-routine", label: "проверяет кормление, сон и тепло младенца по порядку", trigger: "каждый уход", strength: 95 }] },
      schedule: [{ from: 0, to: 24, locationId: NURSERY, activity: "ухаживает за детьми в детской" }]
    };

    const birthEvent = (id: string, text: string): ScheduledWorldEvent => {
      const birth = REYNAR_ASSUMED_BIRTH_DAYS[id]!;
      return { id: `reynar:birth:${id}`, minute: minuteOfKL(birth.year, birth.day, startYearKL, 6 * 60), locationId: CHAMBER, text, npcBirthId: id, provenance: "canon-date-assumed" };
    };
    events.push(
      birthEvent("rey-maren", "В 724 КЛ у принцессы Элианы и Гарена Вальда родилась дочь: Марен Рейнар."),
      {
        id: "reynar:death:rey-second-prince-mother", minute: 2 * YEAR + 8 * 60 + 10, locationId: NURSERY,
        text: "В 725 КЛ мать второго принца умерла. Причина смерти не установлена; двор ограничился кратким официальным сообщением.",
        npcDeathId: "rey-second-prince-mother", provenance: "canon-date-assumed"
      },
      birthEvent("rey-fourth-princess", "В 726 КЛ у принцессы Элианы и Гарена Вальда родилась дочь: Элиза Рейнар."),
      birthEvent("rey-oren", "В 727 КЛ у принцессы Элианы и Гарена Вальда родился сын: Орен Рейнар."),
      {
        id: "reynar:accession:rey-elin", minute: minuteOfKL(735, 120, startYearKL, 10 * 60), locationId: CHAMBER,
        // Обстоятельства передачи власти в каноне не описаны и намеренно не выдумываются.
        text: "В 735 КЛ Элиана III Рейнар становится королевой Эстрана. Обстоятельства передачи власти в доступной хронике не описаны.",
        provenance: "canon-date-assumed"
      }
    );
  }
  return { npcs, locations, events };
}
