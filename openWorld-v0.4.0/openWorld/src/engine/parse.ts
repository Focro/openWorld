import type { Action, WorldData } from "./types";

export type ParseResult = { ok: true; action: Action } | { ok: false; reason: string };

export const normalize = (s: string) =>
  s.toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/\s+/g, " ").trim();

type Match = { kind: "one"; id: string } | { kind: "none" } | { kind: "many" };

function findByName(defs: Record<string, { id: string; name: string }>, query: string): Match {
  const q = normalize(query);
  if (!q) return { kind: "none" };
  const all = Object.values(defs);
  const exact = all.filter((d) => normalize(d.name) === q || d.id === q);
  const hits = exact.length ? exact : all.filter((d) => normalize(d.name).includes(q));
  if (hits.length === 1) return { kind: "one", id: hits[0]!.id };
  return hits.length ? { kind: "many" } : { kind: "none" };
}

const LOOK = ["осмотреться", "осмотр", "look"];
const INVENTORY = ["инвентарь", "вещи", "inventory", "inv"];
const WAIT = ["ждать", "подождать", "wait"];
const MOVE = ["идти", "пойти", "go", "move"];
const BUY = ["купить", "buy"];

/** Разбирает текст игрока в типизированное действие. Не меняет состояние. */
export function parseAction(world: WorldData, text: string): ParseResult {
  const norm = normalize(text);
  if (!norm) return { ok: false, reason: "Введите действие." };
  const [cmd = "", ...rest] = norm.split(" ");
  const arg = rest.join(" ");

  if (LOOK.includes(cmd)) return { ok: true, action: { type: "look" } };
  if (INVENTORY.includes(cmd)) return { ok: true, action: { type: "inventory" } };

  if (WAIT.includes(cmd)) {
    if (!arg) return { ok: true, action: { type: "wait", minutes: 60 } };
    const m = /^(\d+)\s*(мин\S*|час\S*)?$/.exec(arg);
    if (!m) return { ok: false, reason: "Не понял, сколько ждать. Пример: «подождать 30 мин» или «подождать 2 часа»." };
    const n = Number(m[1]);
    const minutes = m[2]?.startsWith("час") ? n * 60 : n;
    return { ok: true, action: { type: "wait", minutes } };
  }

  if (MOVE.includes(cmd)) {
    const query = arg.replace(/^(в|к|на)\s+/, "");
    const found = findByName(world.locations, query);
    if (found.kind === "none") return { ok: false, reason: "Не понял, куда идти." };
    if (found.kind === "many") return { ok: false, reason: "Уточните, куда именно идти." };
    return { ok: true, action: { type: "move", to: found.id } };
  }

  if (BUY.includes(cmd)) {
    const m = /^(.*?)(?:\s+(\d+))?$/.exec(arg);
    const found = findByName(world.items, m?.[1] ?? "");
    if (found.kind === "none") return { ok: false, reason: "Не понял, что покупать." };
    if (found.kind === "many") return { ok: false, reason: "Уточните, что именно купить." };
    return { ok: true, action: { type: "buy", item: found.id, qty: m?.[2] ? Number(m[2]) : 1 } };
  }

  return { ok: false, reason: "Пока это действие не поддерживается. Мир не изменился." };
}
