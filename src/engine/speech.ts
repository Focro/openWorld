/**
 * Живая речь NPC (0.15.0).
 *
 * Готовых реплик здесь нет и быть не должно: слова NPC пишет нейросеть. Движок отвечает за
 * то, чего модель знать не может или может перепутать:
 *  1. speechProfile: короткий «паспорт речи» (возраст, характер, сословие, край). Девочка
 *     семи лет и тридцатилетний кузнец получают разные описания, а значит говорят по-разному;
 *  2. buildSceneContext: компактная сцена (кто рядом, как относится к игроку, что помнит,
 *     последние реплики), чтобы ответы были связными и не стоили много токенов;
 *  3. coerceScene и applyScene: проверка ответа модели (говорит только тот, кто рядом)
 *     и запись сказанного в хронику и память свидетелей.
 */
import type { GameState, MemoryEntry, NpcDef, PersonalityTraits, WorldData } from "./types";
import { npcsAt } from "./world";
import { deriveNpcPersonality } from "./personality";
import { describeAttitude } from "./relations";
import { capabilities, formatAge, MINUTES_PER_YEAR } from "./development";
import { formatClock, yearKLOf } from "./time";
import { normalize } from "./parse";
import { buildTriggeredKnowledge } from "./knowledge";

export type GameLanguage = "ru" | "en";
export const isGameLanguage = (value: string): value is GameLanguage => value === "ru" || value === "en";

/** Длинное и среднее тире заменяются: так просил автор проекта. */
export function stripDashes(text: string): string {
  return text
    .replace(/([.!?…,:;])\s+[—–]\s+/g, "$1 ")
    .replace(/\s+[—–]\s+/g, ", ")
    .replace(/^[—–]\s*/gm, "")
    .replace(/[—–]/g, "-");
}

/** Сколько NPC лет сейчас (или undefined, если возраст не задан данными мира). */
export function npcAgeYears(npc: NpcDef, state: GameState): number | undefined {
  if (npc.bornAtMinute !== undefined) return Math.max(0, Math.floor((state.minute - npc.bornAtMinute) / MINUTES_PER_YEAR));
  if (npc.birthYear !== undefined) return Math.max(0, yearKLOf(state.minute, state.worldStartYearKL ?? 742) - npc.birthYear);
  return npc.age;
}

/** Имя без пояснения: «Мира Рейн, торговка Ровена» превращается в «Мира Рейн». */
export const shortName = (npc: Pick<NpcDef, "name">) => npc.name.split(/\s+[—–-]\s+|,\s+/)[0]!;

function ageManner(age: number | undefined): string {
  if (age === undefined) return "взрослый";
  if (age < 1) return "младенец: не говорит, только звуки";
  if (age < 3) return `малыш ${age} г.: отдельные слова, коверкает их`;
  if (age < 7) return `ребёнок ${age} лет: короткие простые фразы, много «почему», говорит что думает`;
  if (age < 12) return `ребёнок ${age} лет: простые слова, непосредственность, может хвастаться или стесняться`;
  if (age < 17) return `подросток ${age} лет: то резок, то застенчив, словечки сверстников`;
  if (age < 26) return `молодой человек ${age} лет`;
  if (age < 56) return `${age} лет`;
  return `пожилой человек ${age} лет: неторопливо, поговорки, вспоминает былое`;
}

function traitManner(t: PersonalityTraits): string[] {
  const out: string[] = [];
  if (t.sociability < 35) out.push("немногословен");
  else if (t.sociability > 72) out.push("словоохотлив");
  if (t.warmth > 70) out.push("говорит тепло");
  else if (t.warmth < 35) out.push("сух и холоден");
  if (t.assertiveness > 78) out.push("прямо и властно");
  else if (t.assertiveness < 30) out.push("мягко, уступчиво");
  if (t.pride > 78) out.push("держится с достоинством, не терпит фамильярности");
  if (t.suspicion > 72) out.push("недоверчив к чужим");
  if (t.emotionalReactivity > 72) out.push("вспыльчив");
  if (t.patience < 35) out.push("нетерпелив, перебивает");
  if (t.openness > 72) out.push("любопытен, расспрашивает");
  if (t.discipline > 82) out.push("точен и по делу");
  if (t.empathy > 75) out.push("чуток к чужим чувствам");
  return out.slice(0, 4);
}

const ROLE_MANNER: Record<NonNullable<NpcDef["roleTags"]>[number], string> = {
  noble: "книжная речь, учтивые формулы",
  clergy: "спокойно, обороты своей веры",
  guard: "коротко, по-служебному",
  merchant: "о цене и выгоде, любит поторговаться",
  healer: "заботливо, расспрашивает о самочувствии",
  commoner: "просто, по-народному"
};

/** Манера речи по краю. Это не готовые фразы, а подсказка для модели, как звучит человек. */
const REGION_MANNER: Record<string, string> = {
  estran: "простая эстранская речь",
  sahrad: "цветисто, с благопожеланиями и притчами",
  tharvek: "скупо и прямо, клятвенные обороты",
  varent: "бойко, с иронией и счётом",
  elyndor: "негромко, образы леса и воды",
  kharum: "церемонно вежливо, через ранги и формулы"
};

const CARE_ROLE: Record<NonNullable<NpcDef["caregiving"]>["role"], string> = {
  mother: "мать игрока", father: "отец игрока", "wet-nurse": "кормилица игрока", nanny: "няня игрока",
  relative: "родственник игрока", guardian: "опекун игрока", teacher: "наставник игрока"
};

/** Короткий паспорт речи NPC: стабилен между ходами и укладывается примерно в 200 символов. */
export function speechProfile(world: WorldData, state: GameState, npcId: string): string {
  const npc = world.npcs[npcId];
  if (!npc) return "";
  const personality = deriveNpcPersonality(npc);
  const age = npcAgeYears(npc, state);
  const parts = [ageManner(age), personality.temperament.split(/[;(]/)[0]!.trim().slice(0, 60), ...traitManner(personality.traits)];
  const role = npc.roleTags?.find(tag => tag !== "commoner") ?? npc.roleTags?.[0];
  // Ребёнку не нужна «книжная речь»: возраст важнее сословия.
  if (role && (age === undefined || age >= 12)) parts.push(ROLE_MANNER[role]);
  const region = npc.originStateId ? REGION_MANNER[npc.originStateId] : undefined;
  if (region && (age === undefined || age >= 3)) parts.push(region);
  return stripDashes(parts.filter(Boolean).join("; "));
}

/** Сцена для модели: только то, что нужно, чтобы ответить живо и в характере. */
export interface SceneContext {
  lang: GameLanguage;
  t: string;
  here: string;
  /** Кто говорит с NPC: имя и возраст или этап жизни. */
  me: string;
  npcs: Array<{ id: string; name: string; who?: string; talk: string; rel: string; mem?: string[] }>;
  /** Последние события и реплики в этом месте: для связности разговора. */
  recent: string[];
  /** Кому игрок обращается, если это понятно из текста. */
  to?: string;
  facts?: string[];
  /** Что произошло: речь, жест, детское действие, осмотр или приход в новое место. */
  event: SceneEvent;
  /** Описание места: только при осмотре и приходе, чтобы повествование было предметным. */
  place?: string;
}
export type SceneEvent = "speech" | "gesture" | "infant" | "look" | "arrival";

const trim = (text: string, max: number) => text.length > max ? `${text.slice(0, max - 1)}…` : text;

/** Кому адресована реплика: по имени в тексте. */
export function addressedNpc(world: WorldData, ids: string[], text: string): string | undefined {
  const words = normalize(text).split(/[^a-zа-я0-9]+/).filter(word => word.length >= 3);
  return ids.find(id => {
    const first = normalize(shortName(world.npcs[id]!)).split(/\s+/);
    return first.some(part => part.length >= 3 && words.some(word => word.startsWith(part.slice(0, Math.max(3, part.length - 2)))));
  });
}

export function buildSceneContext(world: WorldData, state: GameState, playerText: string, lang: GameLanguage = "ru", event: SceneEvent = "speech", maxNpcs = 6): SceneContext {
  const loc = world.locations[state.playerLocation]!;
  const present = npcsAt(world, state.minute, loc.id, state.npcDeaths);
  const to = addressedNpc(world, present, playerText);
  // Сначала тот, к кому обращаются, затем близкие и знакомые, затем остальные.
  const score = (id: string) => (id === to ? 100 : 0) + (world.npcs[id]!.caregiving ? 20 : 0) + (state.relations[id] ? 5 : 0) + (loc.shop?.keeperId === id ? 3 : 0);
  const chosen = [...present].sort((a, b) => score(b) - score(a)).slice(0, maxNpcs);
  const recentEntries = state.chronicle.filter(event => event.locationId === loc.id).slice(-4);
  const recentIds = new Set(recentEntries.map(event => event.id));
  const facts = buildTriggeredKnowledge(world, state, playerText);
  const age = state.development ? `${capabilities(state.development, state.minute).stage.label}, ${formatAge(state.development, state.minute)}` : `${state.playerProfile?.age ?? "взрослый"}${state.playerProfile?.age ? " лет" : ""}`;
  return {
    lang,
    t: formatClock(state.minute),
    here: loc.name,
    me: `${state.playerName}, ${age}`,
    npcs: chosen.map(id => {
      const npc = world.npcs[id]!;
      const memories = (state.npcMemory[id] ?? []).filter((entry: MemoryEntry) => !entry.eventId || !recentIds.has(entry.eventId)).slice(-2).map(entry => trim(entry.text, 120));
      const who = npc.caregiving ? CARE_ROLE[npc.caregiving.role] : loc.shop?.keeperId === id ? "хозяин лавки" : undefined;
      return {
        id, name: shortName(npc),
        ...(who ? { who } : {}),
        talk: speechProfile(world, state, id),
        rel: state.relations[id] ? describeAttitude(state.relations[id]!) : "незнаком",
        ...(memories.length ? { mem: memories } : {})
      };
    }),
    recent: recentEntries.map(event => trim(event.text, 160)),
    ...(to ? { to } : {}),
    ...(facts.length ? { facts } : {}),
    event,
    ...(event === "look" || event === "arrival" ? { place: trim(loc.description, 600) } : {})
  };
}

export const SCENE_PROTOCOL = "openworld-scene-v1";
/** Стабильные инструкции сцены: одинаковы между ходами, поэтому кэшируются у провайдеров. */
export const SCENE_INSTRUCTIONS = [
  "Ты рассказчик и голоса людей в текстовой RPG. Игрок сделал ход (playerText, event), ты описываешь, как откликается мир.",
  "ГЛАВНЫЙ ЗАПРЕТ: ты никогда не пишешь за героя игрока (me). Не описываешь его слова, действия, мысли, чувства, ощущения, решения и реакции, не пишешь «вы почувствовали», «вы улыбнулись», «ты решаешь». Герой делает и чувствует только то, что написал игрок. Ты пишешь только мир и других людей и останавливаешься там, где герою пора действовать.",
  "narration: литературное повествование, развёрнутое и образное: место, свет, звуки, запахи, что делают люди вокруг, их жесты и выражения лиц. При event look или arrival подробно опиши место по place. Несколько абзацев допустимы, если сцене есть что показать.",
  "replies: живые реплики людей рядом. У каждого свой голос по talk (возраст, характер, сословие, край): ребёнок говорит как ребёнок, старик как старик, стражник не как торговка. Разговорная речь, оговорки, недосказанность, никакой одинаковой вежливости. Длина по характеру: болтун говорит много, молчун мало.",
  "Говорит тот, кому есть что сказать; если обратились по имени (to), отвечает он. Можно молчать, если человеку не до того. rel: отношение к игроку, mem: что человек помнит. Не выдумывай общего прошлого и фактов о мире сверх facts и recent.",
  "Не меняй мир: никто не отдаёт вещи, не называет новых цен, не уходит, не нападает и не умирает. Последствия решает движок.",
  "Пиши на языке lang (ru или en). Не используй длинное тире."
];

export function buildSceneEnvelope(context: SceneContext, playerText: string) {
  return {
    protocol: SCENE_PROTOCOL,
    systemInstructions: SCENE_INSTRUCTIONS,
    context,
    playerText,
    outputContract: { type: "object" as const, required: ["replies"], speakers: context.npcs.map(npc => npc.id), maxReplies: MAX_SCENE_REPLIES, maxCharacters: MAX_REPLY_CHARS }
  };
}
export type SceneEnvelope = ReturnType<typeof buildSceneEnvelope>;

/** Транспорт сцены (прокси ИИ). Движок не знает, какой провайдер её пишет. */
export interface SceneWriter {
  writeScene(envelope: SceneEnvelope): Promise<unknown>;
}

export interface SceneReply { npcId: string; text: string }
export interface Scene { replies: SceneReply[]; narration?: string }

/** Щедрые пределы только от сбоев модели: игрока не ограничиваем. */
export const MAX_SCENE_REPLIES = 6;
export const MAX_REPLY_CHARS = 2000;
export const MAX_NARRATION_CHARS = 6000;

const sentences = (text: string) => text.split(/(?<=[.!?…»"])\s+(?=\S)/);
const END = "(?=[\\s,.!?;:…»\"]|$)";
const HERO_START = new RegExp(`^[«"(*\\s]*(вы|ты|you)${END}`, "i");
const HERO_INNER = /(^|[\s,;:(])(ваш[а-яё]*|тво[а-яё]+|your)\s+(сердц|мысл|душ|дыхани|heart|mind|thought|breath)|(^|[\s,;:(])(вас|тебя|you)\s+(охватыва|охватил|переполня|переполнил|накрыва|накрыл|пронза|пронзил|захлёстыва|overwhelm|fill)/i;
const HERO_SUBJECT = new RegExp(`(^|[\\s,;:(])(вы|ты)\\s+(?:уже\\s+|вдруг\\s+|невольно\\s+|снова\\s+)?[а-яё]+(ете|ите|ёте|ешь|ишь|ёшь|ли|лись|ла|лась|ло|л|лся)${END}`, "i");
const HERO_EN = /\byou\s+(?:suddenly\s+|slowly\s+)?(feel|felt|think|thought|say|said|nod|nodded|smile|smiled|decide|decided|want|wanted|realize|realized|notice|noticed|sense|sensed|reply|replied|answer|answered|take|took|turn|turned|step|stepped|walk|walked|laugh|laughed|sigh|sighed|remember|remembered)\b/i;

/**
 * Убирает из текста рассказчика предложения, где модель решает за героя игрока:
 * «Вы улыбаетесь», «ты чувствуешь», «Ирина кивает». Обращение к герою в косвенном
 * падеже («мать берёт вас на руки») остаётся: это действие другого человека.
 */
export function removeHeroActions(text: string, playerName = ""): { text: string; removed: number } {
  const first = playerName.trim().split(/\s+/)[0] ?? "";
  const nameRe = first.length >= 2 ? new RegExp(`(^|[\\s,;:(«"])${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(?:уже\\s+|вдруг\\s+)?[а-яё]+(ет|ёт|ит|ется|ётся|ится|ал|ала|ел|ела|ил|ила|ул|ула|ял|яла|ался|алась|ился|илась)${END}`, "i") : null;
  let removed = 0;
  const kept = text.split(/\n+/).map(paragraph => sentences(paragraph).filter(sentence => {
    const bad = HERO_START.test(sentence) || HERO_INNER.test(sentence) || HERO_SUBJECT.test(sentence) || HERO_EN.test(sentence) || Boolean(nameRe?.test(sentence));
    if (bad) removed++;
    return !bad;
  }).join(" ")).filter(paragraph => paragraph.trim()).join("\n\n");
  return { text: kept.trim(), removed };
}

/** Приводит ответ модели к сцене: говорят только присутствующие, за героя никто не решает, без длинных тире. */
export function coerceScene(raw: unknown, speakers: string[], playerName = ""): Scene | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as { replies?: unknown; narration?: unknown };
  const replies: SceneReply[] = [];
  if (Array.isArray(r.replies)) for (const item of r.replies) {
    if (replies.length >= MAX_SCENE_REPLIES) break;
    const entry = item as { npc?: unknown; text?: unknown };
    if (typeof entry?.npc !== "string" || !speakers.includes(entry.npc) || typeof entry.text !== "string") continue;
    const text = stripDashes(entry.text.trim()).replace(/^["«]+|["»]+$/g, "").slice(0, MAX_REPLY_CHARS);
    if (text) replies.push({ npcId: entry.npc, text });
  }
  const narration = typeof r.narration === "string" ? removeHeroActions(stripDashes(r.narration.trim()), playerName).text.slice(0, MAX_NARRATION_CHARS) : "";
  if (!replies.length && !narration) return null;
  return narration ? { replies, narration } : { replies };
}

/**
 * Записывает сцену в мир: каждая реплика становится событием хроники от имени NPC,
 * её слышат все, кто рядом, а игрок запоминает её как свой опыт. Время не идёт.
 */
export function applyScene(world: WorldData, state: GameState, scene: Scene): { state: GameState; lines: string[] } {
  const loc = state.playerLocation;
  const witnesses = npcsAt(world, state.minute, loc, state.npcDeaths);
  let chronicle = state.chronicle;
  const npcMemory = { ...state.npcMemory };
  const playerMemory = [...state.playerMemory];
  const lines: string[] = [];
  const record = (text: string, sourceId?: string) => {
    const id = `e${chronicle.length + 1}`;
    chronicle = [...chronicle, { id, minute: state.minute, locationId: loc, text, witnesses, source: sourceId ? { kind: "npc", id: sourceId } : { kind: "system" } }];
    for (const npcId of witnesses) npcMemory[npcId] = [...(npcMemory[npcId] ?? []), { minute: state.minute, text, kind: "witnessed", confidence: 1, eventId: id }];
    playerMemory.push({ minute: state.minute, text, kind: "own", confidence: 1, eventId: id });
    lines.push(...text.split(/\n{2,}/).map(paragraph => paragraph.trim()).filter(Boolean));
  };
  if (scene.narration) record(scene.narration);
  for (const reply of scene.replies) {
    const npc = world.npcs[reply.npcId];
    if (npc && witnesses.includes(reply.npcId)) record(`${shortName(npc)}: «${reply.text}»`, reply.npcId);
  }
  return { state: { ...state, chronicle, npcMemory, playerMemory }, lines };
}

/** Слышит ли кто-нибудь игрока сейчас: без слушателей сцену не пишем и токены не тратим. */
export const hasListeners = (world: WorldData, state: GameState) => npcsAt(world, state.minute, state.playerLocation, state.npcDeaths).length > 0;
