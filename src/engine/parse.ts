import type { Action, WorldData } from "./types";
import { classifyClaim } from "./social";
import { isHaircutDescriptionAllowed } from "./appearance";

export type ParseResult = { ok: true; action: Action } | { ok: false; reason: string };

export const normalize = (s: string) =>
  s.toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/\s+/g, " ").trim();

type Match = { kind: "one"; id: string } | { kind: "none" } | { kind: "many" };

function findByName(defs: Record<string, { id: string; name: string }>, query: string): Match {
  const q = normalize(query);
  if (!q) return { kind: "none" };
  const all = Object.values(defs);
  const exact = all.filter(d => normalize(d.name) === q || d.id === q);
  const hits = exact.length ? exact : all.filter(d => normalize(d.name).includes(q));
  if (hits.length === 1) return { kind: "one", id: hits[0]!.id };
  return hits.length ? { kind: "many" } : { kind: "none" };
}

const LOOK = ["осмотреться", "осмотр", "look"];
const INVENTORY = ["инвентарь", "вещи", "inventory", "inv"];
const WAIT = ["ждать", "подождать", "wait"];
const MOVE = ["идти", "пойти", "go", "move"];
const BUY = ["купить", "buy"];
const HAIRCUT = ["постричься", "подстричься", "сменить-прическу", "сменитьприческу"];
const CHANGE_CLOTHES = ["переодеться", "сменить-одежду", "сменитьодежду"];
const CLOTHING_ACTIONS: Record<string, { condition: "wrinkled" | "dirty" | "torn" | "wet" | "poorly-fastened"; active: boolean }> = {
  "помять-одежду": { condition: "wrinkled", active: true }, "помятьодежду": { condition: "wrinkled", active: true },
  "испачкать-одежду": { condition: "dirty", active: true }, "испачкатьодежду": { condition: "dirty", active: true },
  "порвать-одежду": { condition: "torn", active: true }, "порватьодежду": { condition: "torn", active: true },
  "намочить-одежду": { condition: "wet", active: true }, "намочитьодежду": { condition: "wet", active: true },
  "поправить-одежду": { condition: "wrinkled", active: false }, "поправитьодежду": { condition: "wrinkled", active: false },
  "застегнуть-одежду": { condition: "poorly-fastened", active: false }, "застегнутьодежду": { condition: "poorly-fastened", active: false },
  "помял": { condition: "wrinkled", active: true }, "помяла": { condition: "wrinkled", active: true },
  "испачкал": { condition: "dirty", active: true }, "испачкала": { condition: "dirty", active: true },
  "порвал": { condition: "torn", active: true }, "порвала": { condition: "torn", active: true },
  "намочил": { condition: "wet", active: true }, "намочила": { condition: "wet", active: true },
  "поправил": { condition: "wrinkled", active: false }, "поправила": { condition: "wrinkled", active: false },
  "застегнул": { condition: "poorly-fastened", active: false }, "застегнула": { condition: "poorly-fastened", active: false }
};
const SAY = ["сказать", "произнести", "заявить", "проповедовать", "say"];
const GESTURE = ["показать", "показываю", "указать", "указываю", "кивнуть", "киваю", "помахать", "машу", "жестом"];
/** Действия младенца и маленького ребёнка. Доступность проверяет движок по вехам развития. */
const INFANT: Record<string, import("./development").InfantActId> = {
  "плакать": "cry", "плачу": "cry", "заплакать": "cry", "реветь": "cry",
  "спать": "sleep", "уснуть": "sleep", "заснуть": "sleep",
  "есть": "feed", "кушать": "feed", "грудь": "feed", "просить-грудь": "feed",
  "улыбнуться": "smile", "улыбаюсь": "smile", "улыбаться": "smile",
  "смотреть": "watch", "наблюдать": "watch", "смотреть-вокруг": "watch",
  "тянуться": "reach", "потянуться": "reach",
  "прижаться": "cling", "обнять": "cling",
  "лепетать": "babble", "гулить": "babble", "агукать": "babble",
  "играть": "play", "поиграть": "play"
};
const LIVE = ["прожить", "жить", "расти"];

/** Разбирает текст игрока в типизированное действие. Не меняет состояние. */
export function parseAction(world: WorldData, text: string): ParseResult {
  const norm = normalize(text);
  if (!norm) return { ok: false, reason: "Введите действие." };
  const [cmd = "", ...rest] = norm.split(" ");
  const arg = rest.join(" ");

  if (LOOK.includes(cmd)) return { ok: true, action: { type: "look" } };
  if (INVENTORY.includes(cmd)) return { ok: true, action: { type: "inventory" } };
  const clothingAction = CLOTHING_ACTIONS[norm.replace(/\s+/g, "-")] ?? CLOTHING_ACTIONS[cmd];
  if (clothingAction) return { ok: true, action: { type: "clothing-condition", ...clothingAction } };
  if (HAIRCUT.includes(cmd)) return !arg
    ? { ok: false, reason: "Укажи желаемую причёску, например: «постричься коротко»." }
    : isHaircutDescriptionAllowed(arg)
      ? { ok: true, action: { type: "haircut", hairstyle: arg } }
      : { ok: false, reason: "Стрижка меняет только форму и длину волос. Окрашивание и изменение природного цвета волос пока не предусмотрены." };
  if (CHANGE_CLOTHES.includes(cmd)) return arg ? { ok: true, action: { type: "change-clothing", clothing: arg } } : { ok: false, reason: "Укажи одежду, например: «переодеться в чистую рубаху»" };

  const infant = INFANT[norm.replace(/\s+/g, "-")] ?? INFANT[cmd];
  if (infant) return { ok: true, action: { type: "infant", act: infant } };
  if (LIVE.includes(cmd)) {
    const m = /^(\d+)?\s*(дн\S*|сут\S*|недел\S*|месяц\S*|год\S*|лет)?$/.exec(arg);
    if (!m) return { ok: false, reason: "Укажи срок: например, «прожить 7 дней», «прожить месяц» или «прожить год»." };
    const n = m[1] ? Number(m[1]) : 1;
    const unit = m[2] ?? "дн";
    const days = unit.startsWith("недел") ? n * 7 : unit.startsWith("месяц") ? n * 30 : unit.startsWith("год") || unit === "лет" ? n * 365 : n;
    return { ok: true, action: { type: "live", days } };
  }
  if (WAIT.includes(cmd)) {
    if (!arg) return { ok: true, action: { type: "wait", minutes: 60 } };
    const m = /^(\d+)\s*(мин\S*|час\S*|дн\S*|сут\S*|недел\S*|месяц\S*|год\S*)?$/.exec(arg);
    if (!m) return { ok: false, reason: "Не понял, сколько ждать. Укажи число и единицу времени: например, «подождать 30 мин» или «подождать 2 часа»." };
    const n = Number(m[1]);
    const unit = m[2] ?? "мин";
    const minutes = unit.startsWith("час") ? n * 60 : unit.startsWith("дн") || unit.startsWith("сут") ? n * 1440 : unit.startsWith("недел") ? n * 7 * 1440 : unit.startsWith("месяц") ? n * 30 * 1440 : unit.startsWith("год") ? n * 365 * 1440 : n;
    return { ok: true, action: { type: "wait", minutes } };
  }

  if (MOVE.includes(cmd)) {
    const query = arg.replace(/^(в|к|на)\s+/, "");
    const found = findByName(world.locations, query);
    if (found.kind === "none") return { ok: false, reason: "Не понял, куда идти." };
    if (found.kind === "many") return { ok: false, reason: "Уточните, куда именно идти." };
    return { ok: true, action: { type: "move", to: found.id } };
  }

  if (GESTURE.includes(cmd)) {
    const gesture = text.trim();
    return { ok: true, action: { type: "gesture", text: gesture } };
  }

  if (SAY.includes(cmd)) {
    const speech = text.trim().replace(/^(сказать|произнести|заявить|проповедовать|say)\s*/i, "").trim();
    if (!speech) return { ok: false, reason: "Напишите, что именно персонаж говорит." };
    if (speech.length > 1000) return { ok: false, reason: "Реплика слишком длинная: максимум 1000 символов." };
    return { ok: true, action: { type: "say", text: speech } };
  }

  if (BUY.includes(cmd)) {
    const m = /^(.*?)(?:\s+(\d+))?$/.exec(arg);
    const found = findByName(world.items, m?.[1] ?? "");
    if (found.kind === "none") return { ok: false, reason: "Не понял, что покупать." };
    if (found.kind === "many") return { ok: false, reason: "Уточните, что именно купить." };
    return { ok: true, action: { type: "buy", item: found.id, qty: m?.[2] ? Number(m[2]) : 1 } };
  }

  if (classifyClaim(text) !== "ordinary") return { ok: true, action: { type: "say", text: text.trim() } };
  return { ok: false, reason: "Пока это действие не поддерживается. Мир не изменился." };
}
