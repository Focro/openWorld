import { npcActivity, npcLocation as npcLocationForAppearanceEvent, npcsAt } from "./world";
import { applyRelationDelta } from "./relations";
import { travelMinutes } from "./geography";
import { pruneRumors, spreadGossip } from "./gossip";
import { formatClock } from "./time";
import { finalizeDeath } from "./lifecycle";
import { advanceWorldTime } from "./timeflow";
import { capabilities, performInfantAct, memoryFraming, formatAge, INFANT_ACT_LABELS } from "./development";
import { resolveSpeech } from "./social";
import { applyAppearanceChange, observeAppearance } from "./appearance";
import { advanceNpcPsychology } from "./personality";
import type { Action, ActionResult, GameEvent, GameState, Relation, WorldData } from "./types";

export const MAX_WAIT_MINUTES = 720;
export const MAX_BUY_QTY = 99;
export const BUY_ACTION_MINUTES = 5;

function withAppearanceObservation(
  source: GameState["appearanceObservations"], observerId: string, subjectId: string,
  minute: number, locationId: string, appearance: NonNullable<GameState["playerAppearance"]>
): NonNullable<GameState["appearanceObservations"]> {
  const observers = { ...(source ?? {}) };
  observers[observerId] = { ...(observers[observerId] ?? {}), [subjectId]: observeAppearance(observerId, subjectId, minute, locationId, appearance) };
  return observers;
}

export function coins(n: number): string {
  const mod100 = n % 100, mod10 = n % 10;
  if (mod10 === 1 && mod100 !== 11) return `${n} монета`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} монеты`;
  return `${n} монет`;
}

const reject = (state: GameState, message: string): ActionResult =>
  ({ state, ok: false, message, events: [] });

const info = (state: GameState, message: string): ActionResult =>
  ({ state, ok: true, message, events: [] });

/** Записывает событие в хронику, память игрока и память NPC-свидетелей. */
function commit(
  world: WorldData,
  state: GameState,
  patch: Partial<GameState>,
  ev: {
    locationId: string; text: string; playerText: string;
    /** Изменения отношений, вызванные именно этим событием. */
    relations?: Record<string, Partial<Relation>>;
  }
): ActionResult {
  const baseBeforeAge: GameState = { ...state, ...patch, minute: state.minute };
  const targetMinute = patch.minute ?? state.minute;
  const elapsedMinutes = targetMinute - state.minute;
  // Время идёт через общий поток: события мира, развитие и возраст обрабатываются по порядку.
  const flow = advanceWorldTime(world, baseBeforeAge, targetMinute);
  const agedBase = { ...flow.state, minute: targetMinute };
  const psychologicalProgress = advanceNpcPsychology(world, { ...state, chronicle: agedBase.chronicle, npcMemory: agedBase.npcMemory, npcDeaths: agedBase.npcDeaths }, elapsedMinutes);
  const base: GameState = {
    ...agedBase,
    npcPsychology: psychologicalProgress.npcPsychology ?? state.npcPsychology,
    npcBonds: psychologicalProgress.npcBonds ?? state.npcBonds,
    chronicle: psychologicalProgress.chronicle ?? agedBase.chronicle,
    npcMemory: psychologicalProgress.npcMemory ?? agedBase.npcMemory
  };
  const witnesses = npcsAt(world, base.minute, ev.locationId, base.npcDeaths);
  const event: GameEvent = {
    id: `e${base.chronicle.length + 1}`,
    minute: base.minute, locationId: ev.locationId, text: ev.text, witnesses,
    source: { kind: "player" }
  };
  const npcMemory = { ...base.npcMemory };
  for (const npcId of witnesses) {
    npcMemory[npcId] = [...(npcMemory[npcId] ?? []), {
      minute: base.minute, text: ev.text, kind: "witnessed", confidence: 1, eventId: event.id
    }];
  }
  const relations = { ...base.relations };
  const npcAppearanceObservations = { ...(base.npcAppearanceObservations ?? {}) };
  let appearanceObservations = { ...(base.appearanceObservations ?? {}) };
  if (base.playerAppearance) {
    for (const npcId of witnesses) {
      const observation = observeAppearance(npcId, "player", base.minute, ev.locationId, base.playerAppearance);
      npcAppearanceObservations[npcId] = observation;
      appearanceObservations = withAppearanceObservation(appearanceObservations, npcId, "player", base.minute, ev.locationId, base.playerAppearance);
    }
  }
  // Игрок тоже запоминает видимых участников сцены; их удалённые перемены не обновляются сами.
  if (!base.journey && base.playerLocation === ev.locationId) {
    for (const npcId of witnesses) {
      const npc = world.npcs[npcId];
      const appearance = base.npcAppearances?.[npcId] ?? npc?.appearance;
      if (appearance) appearanceObservations = withAppearanceObservation(appearanceObservations, "player", npcId, base.minute, ev.locationId, appearance);
    }
  }
  for (const [npcId, delta] of Object.entries(ev.relations ?? {})) {
    const current = relations[npcId];
    if (current) relations[npcId] = applyRelationDelta(current, delta);
  }
  const withEvent: GameState = {
    ...base,
    chronicle: [...base.chronicle, event],
    playerMemory: [...base.playerMemory, {
      minute: base.minute, ...memoryFraming(base.development, ev.playerText), kind: "own", eventId: event.id
    }],
    npcMemory,
    relations,
    npcAppearanceObservations,
    appearanceObservations
  };
  // Слухи распространяются между NPC, оказавшимися в одной локации; устаревшие забываются.
  const next = pruneRumors(spreadGossip(world, withEvent));
  const extra = [...flow.events.map(e => e.text), ...flow.notices.filter(n => n.important).map(n => n.text)];
  return { state: next, ok: true, message: extra.length ? `${ev.playerText}\n${extra.join("\n")}` : ev.playerText, events: [...flow.events, event] };
}

/**
 * Системное изменение внешности игрока (например, ранение в бою или лечение).
 * Вызывается боевой/медицинской системой, а не свободной командой ИИ.
 */
export function updatePlayerAppearance(
  world: WorldData, state: GameState,
  change: import("./appearance").AppearanceChange, eventText: string
): ActionResult {
  if (!state.playerAppearance) return reject(state, "У персонажа нет профиля внешности.");
  if (change.type === "get-wounded" && change.wound.receivedAt > state.minute) return reject(state, "Нельзя получить рану с датой из будущего игрового времени.");
  if (change.type === "heal-wound" && change.healedAt > state.minute) return reject(state, "Нельзя завершить лечение до наступления указанного игрового времени.");
  const updated = applyAppearanceChange(state.playerAppearance, change);
  if (!updated) return reject(state, "Изменение внешности игрока не прошло проверку.");
  const locationId = state.playerLocation;
  const witnesses = state.journey ? [] : npcsAt(world, state.minute, locationId, state.npcDeaths);
  const text = eventText.trim();
  if (!text || text.length > 300) return reject(state, "Описание события должно содержать от 1 до 300 символов.");
  const observations = { ...(state.appearanceObservations ?? {}) };
  const legacyObservations = { ...(state.npcAppearanceObservations ?? {}) };
  for (const observerId of witnesses) {
    const observation = observeAppearance(observerId, "player", state.minute, locationId, updated);
    legacyObservations[observerId] = observation;
    observations[observerId] = { ...(observations[observerId] ?? {}), player: observation };
  }
  const event = {
    id: `e${state.chronicle.length + 1}`, minute: state.minute, locationId, text,
    witnesses, source: { kind: "system" as const }
  };
  const npcMemory = { ...state.npcMemory };
  for (const observerId of witnesses) {
    npcMemory[observerId] = [...(npcMemory[observerId] ?? []), { minute: state.minute, text, kind: "witnessed", confidence: 1, eventId: event.id }];
  }
  return {
    state: {
      ...state, playerAppearance: updated, npcAppearanceObservations: legacyObservations,
      appearanceObservations: observations, npcMemory,
      playerMemory: [...state.playerMemory, { minute: state.minute, text, kind: "own", confidence: 1, eventId: event.id }],
      chronicle: [...state.chronicle, event]
    },
    ok: true, message: text, events: [event]
  };
}

/**
 * Системное изменение внешности NPC (например, стрижка, ранение или лечение).
 * Не является действием игрока: вызывается событиями симуляции и боевой/медицинской системами.
 * Снимки получают только персонажи, физически присутствующие при событии.
 */
export function updateNpcAppearance(
  world: WorldData, state: GameState, npcId: string,
  change: import("./appearance").AppearanceChange, eventText?: string
): ActionResult {
  const npc = world.npcs[npcId];
  if (!npc || npc.lifeStatus === "dead" || npc.lifeStatus === "missing") return reject(state, "Нельзя изменить внешность отсутствующего или умершего NPC.");
  const current = state.npcAppearances?.[npcId] ?? npc.appearance;
  if (!current) return reject(state, "У этого NPC нет подтверждённого исходного профиля внешности.");
  if (change.type === "get-wounded" && change.wound.receivedAt > state.minute) return reject(state, "Нельзя получить рану с датой из будущего игрового времени.");
  if (change.type === "heal-wound" && change.healedAt > state.minute) return reject(state, "Нельзя завершить лечение до наступления указанного игрового времени.");
  const updated = applyAppearanceChange(current, change);
  if (!updated) return reject(state, "Изменение внешности NPC не прошло проверку.");
  const locationId = npcLocationForAppearanceEvent(world, npcId, state.minute, state.npcDeaths);
  if (!locationId) return reject(state, "NPC сейчас не находится в доступной локации; событие нельзя достоверно разместить.");
  const observers = npcsAt(world, state.minute, locationId, state.npcDeaths).filter(id => id !== npcId);
  const minute = state.minute;
  const text = eventText?.trim() || `${npc.name}: заметное изменение внешности.`;
  const observations = { ...(state.appearanceObservations ?? {}) };
  for (const observerId of observers) {
    const observerMap = { ...(observations[observerId] ?? {}) };
    observerMap[npcId] = observeAppearance(observerId, npcId, minute, locationId, updated);
    observations[observerId] = observerMap;
  }
  if (!state.journey && state.playerLocation === locationId) {
    observations.player = { ...(observations.player ?? {}), [npcId]: observeAppearance("player", npcId, minute, locationId, updated) };
  }
  const event = {
    id: `e${state.chronicle.length + 1}`, minute, locationId, text,
    witnesses: observers, source: { kind: "npc" as const, id: npcId }
  };
  const npcMemory = { ...state.npcMemory };
  for (const observerId of observers) {
    npcMemory[observerId] = [...(npcMemory[observerId] ?? []), { minute, text, kind: "witnessed", confidence: 1, eventId: event.id }];
  }
  return {
    state: {
      ...state,
      npcAppearances: { ...(state.npcAppearances ?? {}), [npcId]: updated },
      appearanceObservations: observations,
      npcMemory,
      chronicle: [...state.chronicle, event]
    },
    ok: true, message: text, events: [event]
  };
}


/**
 * Единственная точка изменения мира. Чистая функция: недопустимое действие
 * возвращает тот же объект состояния без наград и без событий.
 */
export function applyAction(world: WorldData, state: GameState, action: Action): ActionResult {
  if (state.lifeStatus === "dead") return reject(state, "История этого персонажа завершена. Создайте нового героя или новый мир.");
  const here = world.locations[state.playerLocation];
  if (!here) return reject(state, "Текущая локация неизвестна. Мир не изменился.");

  switch (action.type) {
    case "look": {
      const presentIds = npcsAt(world, state.minute, here.id, state.npcDeaths);
      const present = presentIds
        .map((id) => `${world.npcs[id]!.name} (${npcActivity(world, id, state.minute, state.npcDeaths)})`);
      const observations = { ...(state.npcAppearanceObservations ?? {}) };
      let appearanceObservations = { ...(state.appearanceObservations ?? {}) };
      if (state.playerAppearance) {
        for (const npcId of presentIds) {
          const observation = observeAppearance(npcId, "player", state.minute, here.id, state.playerAppearance);
          observations[npcId] = observation;
          appearanceObservations = withAppearanceObservation(appearanceObservations, npcId, "player", state.minute, here.id, state.playerAppearance);
        }
      }
      if (!state.journey) {
        for (const npcId of presentIds) {
          const npc = world.npcs[npcId];
          const appearance = state.npcAppearances?.[npcId] ?? npc?.appearance;
          if (appearance) appearanceObservations = withAppearanceObservation(appearanceObservations, "player", npcId, state.minute, here.id, appearance);
        }
      }
      const observedState = { ...state, npcAppearanceObservations: observations, appearanceObservations };
      const exits = here.exits
        .map((e) => `${world.locations[e.to]?.name ?? e.to} (${e.distanceM} м, ${travelMinutes(e.distanceM, e.terrain, "walk") ?? "не пройти"} мин)`)
        .join(", ");
      return info(observedState,
        `${here.name}. ${here.description} ` +
        `${present.length ? `Здесь: ${present.join(", ")}.` : "Здесь никого нет."} ` +
        `Выходы: ${exits || "нет"}.`);
    }
    case "inventory": {
      const items = Object.entries(state.inventory)
        .filter(([, n]) => n > 0)
        .map(([id, n]) => `${world.items[id]?.name ?? id}${n > 1 ? ` ×${n}` : ""}`);
      return info(state, `При себе: ${items.join(", ") || "ничего"}. Деньги: ${coins(state.money)}.`);
    }
    case "wait": {
      const m = action.minutes;
      if (!Number.isInteger(m) || m < 1 || m > MAX_WAIT_MINUTES)
        return reject(state, `Ждать можно от 1 до ${MAX_WAIT_MINUTES} минут. Мир не изменился.`);
      const minute = state.minute + m;
      return commit(world, state, { minute }, {
        locationId: here.id,
        text: `${state.playerName} ждёт ${m} мин. в локации «${here.name}».`,
        playerText: `Проходит ${m} мин. Сейчас ${formatClock(minute)}.`
      });
    }
    case "move": {
      const exit = here.exits.find((e) => e.to === action.to);
      const target = typeof action.to === "string" ? world.locations[action.to] : undefined;
      if (!exit || !target)
        return reject(state, "Отсюда нет такого пути. Мир не изменился.");
      const caps = capabilities(state.development, state.minute);
      if (!caps.canWalk) return reject(state, caps.canCrawl
        ? "Вы умеете только ползать: из комнаты вас выносят взрослые, сами вы туда не доберётесь."
        : "Вы ещё не ходите. Вас носят на руках, и куда: решают взрослые.");
      if (exit.distanceM > caps.maxUnaccompaniedExitM) return reject(state, `Для ребёнка этого возраста путь слишком далёк: одного вас туда не отпустят (${exit.distanceM} м).`);
      const minutes = travelMinutes(exit.distanceM, exit.terrain, "walk");
      if (minutes === null) return reject(state, "Пешком здесь не пройти. Мир не изменился.");
      const minute = state.minute + minutes;
      return commit(world, state, { minute, playerLocation: target.id }, {
        locationId: target.id,
        text: `${state.playerName} приходит в локацию «${target.name}».`,
        playerText: `Вы идёте ${minutes} мин и приходите: ${target.name}. Сейчас ${formatClock(minute)}.`
      });
    }
    case "gesture": {
      if (typeof action.text !== "string" || !action.text.trim() || action.text.length > 4000)
        return reject(state, "Жест или действие должно быть описано в пределах 4000 символов.");
      const minute = state.minute + 1;
      const speechless = state.development ? capabilities(state.development, state.minute).maxWordsPerUtterance < 6 : (state.playerProfile?.age ?? 22) < 5;
      const reaction = speechless
        ? "Вы выражаете намерение жестом, звуком или движением, не словами. Взрослые могут попытаться понять вас, но не обязаны верно истолковать." 
        : "Вы используете жест или мимику. Окружающие видят действие, но не читают ваши мысли.";
      return commit(world, state, { minute }, {
        locationId: here.id,
        text: `${state.playerName} действует невербально: «${action.text.trim()}».`,
        playerText: `${reaction} Сейчас ${formatClock(minute)}.`
      });
    }
    case "say": {
      if (typeof action.text !== "string" || !action.text.trim() || action.text.length > 4000)
        return reject(state, "Реплика должна содержать от 1 до 4000 символов. Мир не изменился.");
      if (state.development) {
        const limit = capabilities(state.development, state.minute).maxWordsPerUtterance;
        const words = action.text.trim().split(/\s+/).filter(Boolean).length;
        if (limit === 0) return reject(state, `Вы ещё не говорите (${formatAge(state.development, state.minute)}). Можно плакать, лепетать, улыбаться и тянуться к людям.`);
        if (words > limit) return reject(state, `Пока вы произносите не больше ${limit} ${limit === 1 ? "слова" : "слов"} за раз. Скажите короче.`);
      } else if ((state.playerProfile?.age ?? 22) < 5)
        return reject(state, "До пяти лет связная речь ещё недоступна. Можно действовать жестами, звуками и простыми детскими поступками.");
      const speakingMinute = state.minute + 1;
      const witnesses = npcsAt(world, speakingMinute, here.id, state.npcDeaths);
      const speech = resolveSpeech(world, { ...state, minute: speakingMinute }, action.text.trim(), witnesses);
      const result = commit(world, state, { minute: speakingMinute, socialState: speech.state.socialState }, {
        locationId: here.id,
        text: `${state.playerName} говорит: «${action.text.trim()}»`,
        playerText: `Вы говорите: «${action.text.trim()}». ${speech.reaction}`
      });
      if (!result.ok || !speech.deathCause) return result;
      const dead = finalizeDeath(world, result.state, {
        minute: speakingMinute,
        cause: speech.deathCause,
        locationId: here.id,
        witnessedBy: witnesses
      });
      return { ...result, state: dead, message: `${result.message} Ваша история закончена.` };
    }
    case "haircut": {
      if (!state.playerAppearance) return reject(state, "Внешность персонажа ещё не задана. Изменение не применено.");
      const appearance = applyAppearanceChange(state.playerAppearance, { type: "haircut", hairstyle: action.hairstyle });
      if (!appearance) return reject(state, "Не удалось распознать новую причёску. Мир не изменился.");
      const minute = state.minute + 1;
      return commit(world, state, { minute, playerAppearance: appearance }, {
        locationId: here.id,
        text: `${state.playerName} меняет причёску: ${appearance.hairstyle}.`,
        playerText: `Вы меняете причёску: ${appearance.hairstyle}. Ваши биологические признаки не меняются. Сейчас ${formatClock(minute)}.`
      });
    }
    case "change-clothing": {
      if (!state.playerAppearance) return reject(state, "Внешность персонажа ещё не задана. Изменение не применено.");
      const appearance = applyAppearanceChange(state.playerAppearance, { type: "change-clothing", clothing: action.clothing });
      if (!appearance) return reject(state, "Не удалось распознать одежду. Мир не изменился.");
      const minute = state.minute + 1;
      return commit(world, state, { minute, playerAppearance: appearance }, {
        locationId: here.id,
        text: `${state.playerName} переодевается: ${appearance.clothing}.`,
        playerText: `Вы переодеваетесь: ${appearance.clothing}. Сейчас ${formatClock(minute)}.`
      });
    }
    case "clothing-condition": {
      if (!state.playerAppearance) return reject(state, "Внешность персонажа ещё не задана. Изменение не применено.");
      const appearance = applyAppearanceChange(state.playerAppearance, { type: "set-clothing-condition", condition: action.condition, active: action.active });
      if (!appearance) return reject(state, "Не удалось изменить состояние одежды. Мир не изменился.");
      const minute = state.minute + 1;
      const labels = { wrinkled: "помята", dirty: "испачкана", torn: "порвана", wet: "намокла", "poorly-fastened": "небрежно застёгнута" };
      const description = labels[action.condition];
      const repairText = action.condition === "wrinkled" ? "Вы разглаживаете одежду" : action.condition === "poorly-fastened" ? "Вы поправляете застёжки" : "Вы приводите одежду в порядок";
      return commit(world, state, { minute, playerAppearance: appearance }, {
        locationId: here.id,
        text: action.active ? `${state.playerName}: одежда ${description}.` : `${state.playerName}: ${repairText.toLocaleLowerCase("ru-RU")}.`,
        playerText: action.active ? `Состояние одежды изменилось: она ${description}.` : `${repairText}.`
      });
    }
    case "buy": {
      const shop = here.shop;
      const item = typeof action.item === "string" ? world.items[action.item] : undefined;
      if (!shop) return reject(state, "Здесь ничего не продают. Мир не изменился.");
      if (!capabilities(state.development, state.minute).canTrade) return reject(state, "Ребёнку этого возраста торговцы ничего не продают сами по себе.");
      if (!npcsAt(world, state.minute, here.id, state.npcDeaths).includes(shop.keeperId))
        return reject(state, "Продавца сейчас нет на месте. Мир не изменился.");
      const price = item ? shop.prices[item.id] : undefined;
      if (!item || price === undefined) return reject(state, "Такого товара здесь нет. Мир не изменился.");
      if (!Number.isInteger(action.qty) || action.qty < 1 || action.qty > MAX_BUY_QTY)
        return reject(state, `Количество: от 1 до ${MAX_BUY_QTY}. Мир не изменился.`);
      const cost = price * action.qty;
      if (cost > state.money)
        return reject(state, `Не хватает денег: нужно ${coins(cost)}, у вас ${coins(state.money)}.`);
      const keeper = world.npcs[shop.keeperId]!.name;
      return commit(world, state, {
        minute: state.minute + BUY_ACTION_MINUTES,
        money: state.money - cost,
        inventory: { ...state.inventory, [item.id]: (state.inventory[item.id] ?? 0) + action.qty }
      }, {
        locationId: here.id,
        text: `${state.playerName} купил у ${keeper}: ${item.name} ×${action.qty} за ${coins(cost)}.`,
        playerText: `Вы покупаете: ${item.name} ×${action.qty} за ${coins(cost)}. Покупка занимает ${BUY_ACTION_MINUTES} мин. Сейчас ${formatClock(state.minute + BUY_ACTION_MINUTES)}.`,
        relations: { [shop.keeperId]: { trust: 2, sympathy: 1 } }
      });
    }
    case "infant": {
      const result = performInfantAct(world, state, action.act);
      if (!result.ok || !result.development) return reject(state, result.text);
      const minute = state.minute + Math.max(1, result.minutes);
      const relations: Record<string, Partial<Relation>> = {};
      for (const [id, delta] of Object.entries(result.relationDeltas ?? {})) relations[id] = delta;
      return commit(world, { ...state, development: result.development }, { minute }, {
        locationId: here.id,
        text: result.eventText ?? `${state.playerName}: ${INFANT_ACT_LABELS[action.act]}.`,
        playerText: `${result.text} Сейчас ${formatClock(minute)}.`,
        relations
      });
    }
    case "live":
      return livePeriod(world, state, action.days);
    default:
      return reject(state, "Неизвестное действие. Мир не изменился.");
  }
}


export const MAX_LIVE_DAYS = 365;

/**
 * «Прожить период»: время идёт день за днём, пока не пройдёт указанный срок
 * или не случится важное событие (веха развития, рождение, смерть, коронация).
 * Так длинный пропуск не перескакивает через то, что игрок должен увидеть.
 */
export function livePeriod(world: WorldData, state: GameState, days: number): ActionResult {
  if (state.lifeStatus === "dead") return reject(state, "История этого персонажа завершена.");
  if (!Number.isInteger(days) || days < 1 || days > MAX_LIVE_DAYS) return reject(state, `Прожить можно от 1 до ${MAX_LIVE_DAYS} дней за раз.`);
  if (state.journey) return reject(state, "Во время путешествия используйте продолжение пути.");
  const here = world.locations[state.playerLocation];
  if (!here) return reject(state, "Текущая локация неизвестна. Мир не изменился.");
  let current = state;
  let lived = 0;
  const highlights: string[] = [];
  const events: GameEvent[] = [];
  while (lived < days) {
    const target = current.minute + 1440;
    const flow = advanceWorldTime(world, current, target);
    current = { ...flow.state, minute: target };
    lived += 1;
    events.push(...flow.events);
    const important = [...flow.events.map(e => e.text), ...flow.notices.filter(n => n.important).map(n => n.text)];
    highlights.push(...important);
    if (important.length) break;
  }
  const psychology = advanceNpcPsychology(world, { ...state, chronicle: current.chronicle, npcMemory: current.npcMemory, npcDeaths: current.npcDeaths }, current.minute - state.minute);
  current = { ...current, npcPsychology: psychology.npcPsychology, npcBonds: psychology.npcBonds, chronicle: psychology.chronicle, npcMemory: psychology.npcMemory };
  current = pruneRumors(spreadGossip(world, current));
  const stopped = lived < days ? ` Время остановлено на важном событии (прожито ${lived} из ${days} дн.).` : "";
  const ageText = current.development ? ` Возраст: ${formatAge(current.development, current.minute)}.` : "";
  const summary = `Проходит ${lived} ${lived === 1 ? "день" : lived < 5 ? "дня" : "дней"}.${ageText}${stopped}`;
  current = { ...current, playerMemory: [...current.playerMemory, { minute: current.minute, ...memoryFraming(current.development, summary), kind: "own" }] };
  return { state: current, ok: true, message: highlights.length ? `${summary}\n${highlights.join("\n")}` : summary, events };
}
