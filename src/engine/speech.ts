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
}

const trim = (text: string, max: number) => text.length > max ? `${text.slice(0, max - 1)}…` : text;

/** Кому адресована реплика: по имени в тексте. */
export function addressedNpc(world: WorldData, ids: string[], text: string): string | undefined {
  const words = normalize(text).split(/[^a-zа-я0-9]+/).filter(word => word.length >= 3);
  return ids.find(id => {
    const first = normalize(shortName(world.npcs[id]!)).split(/\s+/);
    return first.some(part => part.length >= 3 && words.some(word => word.startsWith(part.slice(0, Math.max(3, part.length - 2)))));
  });
}

export function buildSceneContext(world: WorldData, state: GameState, playerText: string, lang: GameLanguage = "ru", maxNpcs = 4): SceneContext {
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
    ...(facts.length ? { facts } : {})
  };
}

export const SCENE_PROTOCOL = "openworld-scene-v1";
/** Стабильные инструкции сцены: одинаковы между ходами, поэтому кэшируются у провайдеров. */
export const SCENE_INSTRUCTIONS = [
  "Ты пишешь живую сцену текстовой RPG: что отвечают игроку люди рядом с ним.",
  "У каждого свой голос. talk описывает манеру речи: возраст, характер, сословие, край. Ребёнок говорит как ребёнок, старик как старик, стражник не говорит как торговка. Не делай всех одинаково вежливыми и гладкими.",
  "rel: как NPC относится к игроку, mem: что он помнит. Не выдумывай общего прошлого и фактов о мире сверх facts.",
  "Отвечают один или двое, кому есть что сказать; если обратились по имени (to), отвечает он. Можно не отвечать, если человеку не до того.",
  "Не меняй мир: никто не отдаёт вещи, не называет новых цен, не уходит и не нападает. Последствия решает движок.",
  "Реплика до 300 знаков, разговорная, без пересказа контекста. narration: одна короткая ремарка о жесте или настроении, можно пустую.",
  "Пиши на языке lang (ru или en). Не используй длинное тире."
];

export function buildSceneEnvelope(context: SceneContext, playerText: string) {
  return {
    protocol: SCENE_PROTOCOL,
    systemInstructions: SCENE_INSTRUCTIONS,
    context,
    playerText,
    outputContract: { type: "object" as const, required: ["replies"], speakers: context.npcs.map(npc => npc.id), maxReplies: 2, maxCharacters: 300 }
  };
}
export type SceneEnvelope = ReturnType<typeof buildSceneEnvelope>;

/** Транспорт сцены (прокси ИИ). Движок не знает, какой провайдер её пишет. */
export interface SceneWriter {
  writeScene(envelope: SceneEnvelope): Promise<unknown>;
}

export interface SceneReply { npcId: string; text: string }
export interface Scene { replies: SceneReply[]; narration?: string }

/** Приводит ответ модели к сцене: говорят только присутствующие, не больше двух, без длинных тире. */
export function coerceScene(raw: unknown, speakers: string[]): Scene | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as { replies?: unknown; narration?: unknown };
  const replies: SceneReply[] = [];
  if (Array.isArray(r.replies)) for (const item of r.replies) {
    if (replies.length >= 2) break;
    const entry = item as { npc?: unknown; text?: unknown };
    if (typeof entry?.npc !== "string" || !speakers.includes(entry.npc) || typeof entry.text !== "string") continue;
    const text = stripDashes(entry.text.trim()).replace(/^["«]+|["»]+$/g, "").slice(0, 400);
    if (text) replies.push({ npcId: entry.npc, text });
  }
  const narration = typeof r.narration === "string" ? stripDashes(r.narration.trim()).slice(0, 300) : "";
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
    lines.push(text);
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
