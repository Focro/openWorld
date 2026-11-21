import { applyAction } from "./rules";
import { formatClock, formatWorldDate, yearKLOf } from "./time";
import { npcLocation, npcsAt } from "./world";
import { describeAttitude } from "./relations";
import { describeAppearance } from "./appearance";
import { travelMinutes } from "./geography";
import type { Action, ActionResult, GameState, WorldData } from "./types";
import { buildNpcKnowledge, buildPlayerKnowledge } from "./knowledge";
import { deriveNpcPersonality, describePersonality } from "./personality";
import { capabilities, describeDevelopment, INFANT_ACT_LABELS, type InfantActId } from "./development";

/**
 * Граница между движком и ИИ.
 * ИИ получает только разрешённый контекст и может предложить действие.
 * Он не записывает состояние; предложение проходит обычные правила движка.
 */
export interface PlayerContext {
  time: string;
  location: { id: string; name: string; description: string };
  presentNpcs: string[];
  recentMemory: string[];
  playerProfileSummary?: string;
  resources: { money: number; inventory: Array<{ itemId: string; name: string; quantity: number }> };
  availableExits: Array<{ id: string; name: string; distanceM: number; terrain: string; walkingMinutes: number | null }>;
  shop?: { keeperPresent: boolean; stock: Array<{ itemId: string; name: string; price: number }> };
  playerAppearance?: string;
  playerFamilySummary?: string;
  presentNpcAppearances?: Array<{ id: string; name: string; appearance?: string }>;
  /** Curated facts retrieved from canonical world data, with provenance. */
  worldKnowledge: string[];
  /** Instructions that keep the model from treating missing data as established fact. */
  groundingRules: string[];
  /** Жизненный этап, речь, подвижность, привязанности: модель не должна делать младенца взрослым. */
  lifeStage?: string;
  /** Действия, которые движок сейчас реально примет. Модель предлагает только из этого списка. */
  allowedActions: string[];
}
export interface NpcContext {
  time: string;
  npc: { id: string; name: string; age?: number; familyRole?: string; lifeStatus?: string; playerRelationship?: "biological-parent" | "legal-parent" | "guardian" | "none" };
  player: { name: string; age?: number; dynasticRole?: string; statusId?: string; birthYearKL?: number; lifeStage?: string };
  playerFamilySummary?: string;
  location: { id: string; name: string } | null;
  goals: string[];
  /** Private, stable personality baseline; this shapes responses but is not a dialogue script. */
  personality: { summary: string; traits: import("./types").PersonalityTraits; values: string[]; formativeExperiences: string[]; copingPatterns: string[] };
  /** Habits are learned gradually and can weaken when no longer reinforced. */
  habits: Array<{ label: string; trigger: string; strength: number; repetitions: number }>;
  /** NPC-to-NPC relationships known to this character. */
  socialCircle: Array<{ npcId: string; name: string; familiarity: number; trust: number; warmth: number; tension: number }>;
  attitudeToPlayer: string;
  memory: string[];
  /** Последний облик игрока, который этот NPC действительно видел. */
  lastObservedPlayerAppearance?: string;
  /** Внешность самого NPC: текущее состояние, а не случайное описание модели. */
  ownAppearance?: string;
  /** Последние внешности других людей, которых этот NPC действительно видел. */
  knownAppearanceObservations?: Array<{ subjectId: string; snapshot: string; observedAt: number; locationId: string }>;
  worldKnowledge: string[];
  groundingRules: string[];
}
export interface AiPromptEnvelope {
  protocol: "openworld-ai-context-v1";
  systemInstructions: string[];
  context: PlayerContext;
  playerText: string;
  outputContract: { type: "object"; required: ["type"]; allowedActions: string[] };
}

/** Provider-neutral payload. A server adapter can serialize this without granting model write access. */
export function buildAiPromptEnvelope(context: PlayerContext, playerText: string): AiPromptEnvelope {
  return {
    protocol: "openworld-ai-context-v1",
    systemInstructions: [
      "Ты повествователь и интерпретатор намерений для OpenWorld RPG.",
      "Контекст содержит только разрешённые сведения; источники указаны рядом с фактами.",
      "Не меняй мир и не выдавай несуществующие факты за правду.",
      "Личность NPC — устойчивый психологический фундамент, а не готовый сценарий реплик: отвечай естественно, учитывая темперамент, опыт, привычки, текущие эмоции и отношения.",
      "Не меняй темперамент мгновенно из-за одного события. Новые привычки формируются повторением, укрепляются практикой и могут ослабевать без подкрепления.",
      "Один NPC может вести себя по-разному с разными людьми; не смешивай личную привязанность с общей добротой или характером.",
      "Верни одно предложение действия в структурированном формате; исполнение и проверка принадлежат движку."
    ],
    context,
    playerText,
    outputContract: { type: "object", required: ["type"], allowedActions: context.allowedActions }
  };
}

export interface NpcDialogueEnvelope {
  protocol: "openworld-npc-dialogue-v1";
  systemInstructions: string[];
  context: NpcContext;
  interlocutorText: string;
  outputContract: { type: "object"; required: ["dialogue"]; maxCharacters: number };
}

/** Builds a private NPC response packet without turning personality into a fixed dialogue tree. */
export function buildNpcDialogueEnvelope(context: NpcContext, interlocutorText: string): NpcDialogueEnvelope {
  return {
    protocol: "openworld-npc-dialogue-v1",
    systemInstructions: [
      "Ты отыгрываешь только указанного NPC, а не всеведущего рассказчика.",
      "Личность — устойчивый темперамент и система ценностей, а не готовые реплики или запрет на развитие.",
      "Сначала учитывай темперамент и жизненный опыт, затем привычки, эмоциональное состояние, отношения с собеседником и конкретную ситуацию.",
      "Не делай персонажа одинаково ласковым, грубым, доверчивым или холодным со всеми: отношение зависит от конкретного человека.",
      "Изменения характера и привычек происходят постепенно, через повторяющийся опыт; не переписывай прошлое и не выдумывай травмы или воспоминания.",
      "Отвечай естественно, в рамках знаний NPC. Не раскрывай сведения, которых он не знает."
    ],
    context,
    interlocutorText,
    outputContract: { type: "object", required: ["dialogue"], maxCharacters: 1200 }
  };
}

export interface ActionProposer {
  propose(context: PlayerContext, playerText: string): Promise<unknown>;
}

export function buildPlayerContext(world: WorldData, state: GameState, memoryLimit = 10, query = ""): PlayerContext {
  const loc = world.locations[state.playerLocation]!;
  return {
    time: `${formatWorldDate(state.minute, state.worldStartYearKL ?? 742)} · ${formatClock(state.minute)}`,
    location: { id: loc.id, name: loc.name, description: loc.description },
    presentNpcs: npcsAt(world, state.minute, loc.id, state.npcDeaths).map(id => world.npcs[id]!.name),
    resources: {
      money: state.money,
      inventory: Object.entries(state.inventory).filter(([, quantity]) => quantity > 0).map(([itemId, quantity]) => ({ itemId, name: world.items[itemId]?.name ?? itemId, quantity }))
    },
    availableExits: loc.exits.map(exit => ({
      id: exit.to, name: world.locations[exit.to]?.name ?? exit.to, distanceM: exit.distanceM,
      terrain: exit.terrain, walkingMinutes: travelMinutes(exit.distanceM, exit.terrain, "walk")
    })),
    shop: loc.shop ? {
      keeperPresent: npcsAt(world, state.minute, loc.id, state.npcDeaths).includes(loc.shop.keeperId),
      stock: Object.entries(loc.shop.prices).map(([itemId, price]) => ({ itemId, name: world.items[itemId]?.name ?? itemId, price }))
    } : undefined,
    playerProfileSummary: state.playerProfile ? [
      `${state.playerProfile.age} лет`, state.playerProfile.dynasticRole ? `династическая роль: ${state.playerProfile.dynasticRole}` : "", state.playerProfile.birthYearKL ? `год рождения: ${state.playerProfile.birthYearKL} КЛ` : "", `происхождение: ${state.playerProfile.originId}`,
      `статус: ${state.playerProfile.statusId}`, `занятие: ${state.playerProfile.professionId}`,
      state.playerProfile.biography, state.playerProfile.personality, state.playerProfile.education,
      state.playerProfile.faithId ? `вера: ${state.playerProfile.faithId}` : "",
      state.playerProfile.skills ? `навыки: ${state.playerProfile.skills}` : ""
    ].filter(Boolean).join("; ") : undefined,
    playerAppearance: state.playerAppearance ? describeAppearance(state.playerAppearance) : undefined,
    playerFamilySummary: state.playerProfile?.familySummary,
    presentNpcAppearances: npcsAt(world, state.minute, loc.id, state.npcDeaths).map(id => {
      const npc = world.npcs[id]!;
      const appearance = state.npcAppearances?.[id] ?? npc.appearance;
      return {
        id, name: npc.name,
        appearance: appearance
          ? describeAppearance(appearance)
          : "Внешность не установлена каноническими данными; не выдумывай конкретные черты без наблюдения."
      };
    }),
    recentMemory: state.playerMemory.slice(-memoryLimit).map(m => m.text),
    lifeStage: state.development ? describeDevelopment(state.development, state.minute, world) : undefined,
    allowedActions: allowedActionsFor(state),
    worldKnowledge: buildPlayerKnowledge(world, state, query || `${loc.name} ${loc.description}`),
    groundingRules: [
      "Используй только переданные факты и наблюдения; не превращай предположения в канон.",
      "Если сведений недостаточно, прямо скажи, что это неизвестно, и задай один уточняющий вопрос.",
      "Не раскрывай скрытые цели NPC, секреты, неувиденные события или чужие личные воспоминания.",
      "Не выдумывай цены, расстояния, даты, родство, диагнозы и результаты действий. Их определяет движок.",
      "Возраст и жизненный этап из поля lifeStage обязательны: младенец не говорит, не ходит, не читает и не принимает взрослых решений; ребёнок говорит и действует по возрасту.",
      "Воспоминания с пометкой «до первых связных воспоминаний» персонаж сознательно не помнит.",
      "Наследуемая внешность (цвет кожи, глаз, природный цвет волос, черты лица) неизменна; не описывай её иначе.",
      ...(state.playerProfile?.dynasticRole === "second-prince" ? ["Ты взаимодействуешь с новорождённым наследником: его характеристики — задатки, а не взрослые навыки; не приписывай ему речь или самостоятельные действия, невозможные младенцу."] : [])
    ]
  };
}

export function buildNpcContext(
  world: WorldData, state: GameState, npcId: string, memoryLimit = 10
): NpcContext | null {
  const npc = world.npcs[npcId];
  if (!npc || (state.npcDeaths?.[npcId] !== undefined && state.npcDeaths[npcId]! <= state.minute)) return null;
  const locId = npcLocation(world, npcId, state.minute, state.npcDeaths);
  const loc = locId ? world.locations[locId] : undefined;
  const family = state.playerProfile?.heritage as { biologicalParentIds?: string[]; legalParentIds?: string[]; guardianIds?: string[] } | undefined;
  const playerRelationship = family?.biologicalParentIds?.includes(npcId) ? "biological-parent"
    : family?.legalParentIds?.includes(npcId) ? "legal-parent"
    : family?.guardianIds?.includes(npcId) ? "guardian" : "none";
  return {
    time: `${formatWorldDate(state.minute, state.worldStartYearKL ?? 742)} · ${formatClock(state.minute)}`,
    npc: {
      id: npc.id, name: npc.name,
      age: npc.birthYear !== undefined ? Math.max(0, yearKLOf(state.minute, state.worldStartYearKL ?? 742) - npc.birthYear) : npc.age,
      familyRole: npc.familyRole,
      lifeStatus: npc.lifeStatus,
      playerRelationship
    },
    player: { name: state.playerName, age: state.playerProfile?.age, dynasticRole: state.playerProfile?.dynasticRole, statusId: state.playerProfile?.statusId, birthYearKL: state.playerProfile?.birthYearKL, lifeStage: state.development ? describeDevelopment(state.development, state.minute, world) : undefined },
    playerFamilySummary: playerRelationship !== "none" ? state.playerProfile?.familySummary : undefined,
    location: loc ? { id: loc.id, name: loc.name } : null,
    goals: [...npc.goals],
    personality: (() => {
      const profile = deriveNpcPersonality(npc);
      return { summary: describePersonality(profile), traits: profile.traits, values: [...profile.values], formativeExperiences: [...profile.formativeExperiences], copingPatterns: [...profile.copingPatterns] };
    })(),
    habits: (state.npcPsychology?.[npcId]?.habits ?? []).map(habit => ({ label: habit.label, trigger: habit.trigger, strength: habit.strength, repetitions: habit.repetitions })),
    socialCircle: Object.entries(state.npcBonds?.[npcId] ?? {})
      .filter(([, bond]) => bond.familiarity > 0 || bond.sharedEncounters > 0)
      .sort((a, b) => b[1].familiarity - a[1].familiarity)
      .slice(0, 12)
      .map(([otherId, bond]) => ({ npcId: otherId, name: world.npcs[otherId]?.name ?? otherId, familiarity: bond.familiarity, trust: bond.trust, warmth: bond.warmth, tension: bond.tension })),
    attitudeToPlayer: state.relations[npcId] ? describeAttitude(state.relations[npcId]!) : "нейтрален",
    lastObservedPlayerAppearance: state.appearanceObservations?.[npcId]?.player?.snapshot ?? state.npcAppearanceObservations?.[npcId]?.snapshot,
    knownAppearanceObservations: Object.values(state.appearanceObservations?.[npcId] ?? {})
      .filter(observation => observation.subjectId !== npcId)
      .sort((a, b) => b.observedAt - a.observedAt)
      .slice(0, memoryLimit)
      .map(observation => ({ subjectId: observation.subjectId, snapshot: observation.snapshot, observedAt: observation.observedAt, locationId: observation.locationId })),
    ownAppearance: (() => {
      const appearance = state.npcAppearances?.[npcId] ?? npc.appearance;
      return appearance
        ? describeAppearance(appearance)
        : "Собственная внешность NPC не установлена каноническими данными; не выдумывай конкретные черты.";
    })(),
    worldKnowledge: buildNpcKnowledge(world, npcId, [...(state.npcMemory[npcId] ?? []).slice(-memoryLimit).map(m => m.text), npc.name, loc?.name ?? ""].join(" "), state.minute, state.npcMemory[npcId] ?? [], state.worldStartYearKL ?? 742),
    groundingRules: [
      "Говори только из личного опыта, доступных публичных сведений и собственной памяти.",
      "Не знаешь то, чему не был свидетелем и о чём не слышал.",
      "Не раскрывай чужие тайны и не придумывай факты.",
      "Сохраняй собственную личность: холодный или недоверчивый персонаж не становится внезапно ласковым; мягкий персонаж не обязан соглашаться со всеми.",
      "Учитывай личные границы, привычки и конкретную историю отношений. Привязанность и доверие растут постепенно через последовательный опыт."
    ],
    memory: (state.npcMemory[npcId] ?? []).slice(-memoryLimit).map(m =>
      m.kind === "heard"
        ? `${m.text} (слух от ${world.npcs[m.source ?? ""]?.name ?? "кого-то"}, уверенность ${Math.round(m.confidence * 100)}%)`
        : m.text)
  };
}

/** Какие типы действий движок примет сейчас: ИИ не должен предлагать невозможное по возрасту. */
export function allowedActionsFor(state: GameState): string[] {
  const caps = capabilities(state.development, state.minute);
  const actions = ["look", "wait", "live"];
  if (caps.infantActions.length) actions.push(...caps.infantActions.map(act => `infant:${act}`));
  if (caps.stage.id !== "infancy") actions.push("inventory", "gesture");
  if (caps.canWalk) actions.push("move");
  if (caps.canTrade) actions.push("buy");
  if (caps.maxWordsPerUtterance > 0) actions.push("say");
  if (caps.stage.id !== "infancy" && caps.stage.id !== "early-childhood") actions.push("haircut", "change-clothing", "clothing-condition");
  return actions;
}

const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64;
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v);

/** Приводит неизвестный вывод ИИ к Action или возвращает null. Лишние поля отбрасываются. */
export function coerceProposal(raw: unknown): Action | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  switch (r.type) {
    case "look": return { type: "look" };
    case "inventory": return { type: "inventory" };
    case "wait": return isInt(r.minutes) ? { type: "wait", minutes: r.minutes } : null;
    case "move": return isStr(r.to) ? { type: "move", to: r.to } : null;
    case "buy": return isStr(r.item) && isInt(r.qty) ? { type: "buy", item: r.item, qty: r.qty } : null;
    case "haircut": return isStr(r.hairstyle) ? { type: "haircut", hairstyle: r.hairstyle } : null;
    case "change-clothing": return isStr(r.clothing) ? { type: "change-clothing", clothing: r.clothing } : null;
    case "clothing-condition":
      return ["wrinkled", "dirty", "torn", "wet", "poorly-fastened"].includes(String(r.condition)) && typeof r.active === "boolean"
        ? { type: "clothing-condition", condition: r.condition as import("./appearance").ClothingCondition, active: r.active }
        : null;
    case "live": return isInt(r.days) ? { type: "live", days: r.days } : null;
    case "infant": return typeof r.act === "string" && r.act in INFANT_ACT_LABELS ? { type: "infant", act: r.act as InfantActId } : null;
    case "say": return typeof r.text === "string" && r.text.trim() && r.text.length <= 1000 ? { type: "say", text: r.text } : null;
    case "gesture": return typeof r.text === "string" && r.text.trim() && r.text.length <= 500 ? { type: "gesture", text: r.text } : null;
    default: return null;
  }
}

/** Просит ИИ предложить действие и применяет его по обычным правилам. */
export async function resolveWithAi(
  world: WorldData, state: GameState, playerText: string, proposer: ActionProposer
): Promise<ActionResult> {
  let raw: unknown;
  try {
    raw = await proposer.propose(buildPlayerContext(world, state, 10, playerText), playerText);
  } catch {
    return { state, ok: false, message: "ИИ недоступен. Мир не изменился.", events: [] };
  }
  const action = coerceProposal(raw);
  if (!action) return { state, ok: false, message: "ИИ предложил недопустимое действие. Мир не изменился.", events: [] };
  const key = action.type === "infant" ? `infant:${action.act}` : action.type;
  if (!allowedActionsFor(state).includes(key)) return { state, ok: false, message: "ИИ предложил действие, недоступное персонажу в этом возрасте. Мир не изменился.", events: [] };
  return applyAction(world, state, action);
}
