/**
 * Deterministic, permission-aware retrieval for the future language-model adapter.
 * The index is built from canonical runtime data; the model never receives the
 * entire world bible or private NPC facts by default.
 */
import type { GameState, MemoryEntry, WorldData } from "./types";
import { COUNTRIES, MAP_NODES, REGIONS, ROUTES } from "../worlds/veloria/atlas";
import { UPPER_SOCIETY_ROSTER } from "../worlds/veloria/upperSociety";
import { yearKLOf } from "./time";

export type KnowledgeAudience = "public" | "player" | "npc";
export interface KnowledgeDocument {
  id: string;
  title: string;
  text: string;
  source: string;
  audience: KnowledgeAudience;
  ownerId?: string;
  tags: string[];
  updatedMinute?: number;
}
export interface KnowledgeHit extends KnowledgeDocument { score: number }
export interface RetrievalOptions {
  audience?: "player" | "npc";
  npcId?: string;
  limit?: number;
  maxCharacters?: number;
  nowMinute?: number;
}

const STOP = new Set("и в во на к ко с со от до по за из у о об для при не ни что это как где когда кто ли бы же или а но его её их он она мы вы я ты мне меня мой моя свое свой сейчас здесь там быть был была были есть будет можно нужно хочу хочу чтобы если потому очень уже ещё также тогда только".split(" "));
const SYNONYMS: Record<string, string[]> = {
  "город": ["столица"], "поселение": ["город"],
  "столица": ["город", "правление", "двор"], "правитель": ["король", "королева", "султан", "император", "совет"],
  "король": ["правитель", "монарх", "королева"], "королева": ["правитель", "монарх", "король"],
  "дорога": ["путь", "маршрут", "перевал", "тропа"], "маршрут": ["путь", "дорога", "перевал"],
  "торговля": ["рынок", "купец", "гильдия", "порт", "товар"], "рынок": ["торговля", "купец", "товар"],
  "семья": ["род", "родители", "наследование", "родословная"], "род": ["семья", "династия", "родословная"],
  "вера": ["религия", "храм", "культ", "обряд"], "храм": ["вера", "религия", "священник"],
  "зима": ["снег", "снегопад", "лавина", "холод"], "река": ["переправа", "причал", "брод"]
};
const stem = (token: string): string => token.replace(/(иями|ями|ами|ого|ему|ому|ыми|ими|ать|ять|ить|ться|тся|ов|ев|ей|ой|ый|ий|ая|яя|ое|ее|ые|ие|ам|ям|ах|ях|ом|ем|ую|юю|а|я|ы|и|у|ю|е)$/u, "");
const tokenize = (value: string): string[] => value.toLocaleLowerCase("ru-RU")
  .replace(/[^\p{L}\p{N}-]+/gu, " ").trim().split(/\s+/)
  .filter(token => token.length > 2 && !STOP.has(token)).map(stem);
const expandTerms = (value: string): string[] => {
  const terms = tokenize(value);
  return [...new Set([...terms, ...terms.flatMap(term => SYNONYMS[term] ?? [])])];
};

const indexCache = new WeakMap<WorldData, KnowledgeDocument[]>();

export function buildKnowledgeIndex(world: WorldData): KnowledgeDocument[] {
  const docs: KnowledgeDocument[] = [];
  for (const location of Object.values(world.locations)) docs.push({
    id: `location:${location.id}`, title: location.name,
    text: `${location.name}. ${location.description} Соседние места: ${location.exits.map(e => world.locations[e.to]?.name ?? e.to).join(", ") || "нет"}.`,
    source: `world.locations.${location.id}`, audience: "public", tags: ["локация", "место", location.id]
  });
  for (const npc of Object.values(world.npcs)) docs.push({
    id: `npc:${npc.id}`, title: npc.name,
    text: `${npc.name}. Дом: ${world.locations[npc.homeId]?.name ?? npc.homeId}. Социальные роли: ${(npc.roleTags ?? []).join(", ") || "не указаны"}.`,
    source: `world.npcs.${npc.id}`, audience: "public", tags: ["персонаж", "npc", npc.id]
  });
  docs.push({
    id: "world:overview", title: world.name,
    text: `Название мира: ${world.name}. Начальная локация: ${world.locations[world.startLocationId]?.name ?? world.startLocationId}.`,
    source: "world", audience: "public", tags: ["мир", "начало"]
  });
  // The global atlas is canonical public geography, not hidden-actor or plot-secret data.
  for (const country of (world.globalStartId ? COUNTRIES : [])) docs.push({
    id: `country:${country.id}`, title: country.name,
    text: `${country.name}. Правление: ${country.government}. Правитель: ${country.ruler}. Столица: ${MAP_NODES.find(n => n.id === country.capital)?.name ?? country.capital}. Климат: ${country.climate}. Культура: ${country.culture}. Языки: ${country.languages.join(", ")}. Законы: ${country.laws.join("; ")}. Экспорт: ${country.exports.join(", ")}. Напряжённость: ${country.tensions.join("; ")}. ${country.description}`,
    source: `atlas.countries.${country.id}`, audience: "public", tags: ["страна", "государство", country.id, country.name]
  });
  for (const region of (world.globalStartId ? REGIONS : [])) docs.push({
    id: `region:${region.id}`, title: region.name,
    text: `${region.name}. Государство: ${COUNTRIES.find(c => c.id === region.countryId)?.name ?? region.countryId}. Местность: ${region.terrain}. Ресурсы: ${region.resources.join(", ")}. ${region.notes}`,
    source: `atlas.regions.${region.id}`, audience: "public", tags: ["регион", "местность", region.id]
  });
  for (const node of (world.globalStartId ? MAP_NODES : [])) docs.push({
    id: `settlement:${node.id}`, title: node.name,
    text: `${node.name}. Государство: ${COUNTRIES.find(c => c.id === node.countryId)?.name ?? node.countryId}. Тип поселения: ${node.kind}. Размер: ${node.populationBand}. Климат: ${node.climate}. Особенности: ${node.tags.join(", ")}.`,
    source: `atlas.mapNodes.${node.id}`, audience: "public", tags: ["поселение", "город", "карта", node.id, node.name]
  });
  // Public court register: identity and public office only. Private temperament, habits and family secrets are not indexed here.
  for (const person of (world.globalStartId ? UPPER_SOCIETY_ROSTER : [])) docs.push({
    id: `upper-society:${person.id}`, title: person.name,
    text: `${person.name}. Государство: ${COUNTRIES.find(country => country.id === person.stateId)?.name ?? person.stateId}. Дом: ${person.houseName}. Положение дома: ${person.houseTitle}. Роль: ${person.role}. Резиденция дома: ${person.seat}. Статус в родословной: ${person.status === "alive" ? "подтверждён как живой в текущем каноне" : "жизненный статус не подтверждён"}. ${person.publicContext}`,
    source: `veloria.upperSociety.${person.id}`, audience: "public", tags: ["высший свет", "дворянство", "династия", "дом", person.stateId, person.houseId, person.id]
  });
  for (const route of (world.globalStartId ? ROUTES : [])) {
    const from = MAP_NODES.find(n => n.id === route.from)?.name ?? route.from;
    const to = MAP_NODES.find(n => n.id === route.to)?.name ?? route.to;
    docs.push({
      id: `route:${route.from}:${route.to}`, title: `Путь: ${from} — ${to}`,
      text: `Маршрут между ${from} и ${to}: ${route.days} дн., способ: ${route.mode}, опасность: ${route.danger}.${route.seasonalClosure ? ` Сезонное ограничение: ${route.seasonalClosure}.` : ""}`,
      source: `atlas.routes.${route.from}.${route.to}`, audience: "public", tags: ["маршрут", "дорога", route.from, route.to]
    });
  }
  return docs;
}

export function retrieveKnowledge(
  documents: KnowledgeDocument[], query: string, options: RetrievalOptions = {}
): KnowledgeHit[] {
  const terms = expandTerms(query);
  if (!terms.length) return [];
  const audience = options.audience ?? "player";
  const allowed = documents.filter(doc => doc.audience === "public" ||
    (audience === "player" && doc.audience === "player") ||
    (audience === "npc" && doc.audience === "npc" && doc.ownerId === options.npcId));
  const now = options.nowMinute ?? 0;
  const ranked = allowed.map(doc => {
    const title = tokenize(doc.title);
    const body = tokenize(`${doc.text} ${doc.tags.join(" ")}`);
    const titleHits = terms.filter(term => title.includes(term)).length;
    const bodyHits = terms.filter(term => body.includes(term)).length;
    const phraseBoost = query.trim().length > 3 && doc.title.toLocaleLowerCase("ru-RU").includes(query.trim().toLocaleLowerCase("ru-RU")) ? 4 : 0;
    const recency = doc.updatedMinute === undefined ? 0 : Math.max(0, 1 - Math.max(0, now - doc.updatedMinute) / (60 * 24 * 30));
    return { ...doc, score: titleHits * 3 + bodyHits + phraseBoost + recency };
  }).filter(hit => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const limit = Math.max(1, Math.min(options.limit ?? 6, 20));
  const maxCharacters = Math.max(300, options.maxCharacters ?? 2400);
  const selected: KnowledgeHit[] = [];
  let used = 0;
  for (const hit of ranked) {
    const cost = hit.title.length + hit.text.length + hit.source.length + 24;
    if (used + cost > maxCharacters) continue;
    selected.push(hit); used += cost;
    if (selected.length >= limit) break;
  }
  return selected;
}

export function formatKnowledgeForPrompt(hits: KnowledgeHit[]): string[] {
  return hits.map(hit => `[${hit.title}; источник: ${hit.source}; релевантность: ${hit.score}] ${hit.text}`);
}

/** Small explicit player-facing context; no private NPC goals or sealed plot facts. */
function cachedKnowledgeIndex(world: WorldData): KnowledgeDocument[] {
  const cached = indexCache.get(world);
  if (cached) return cached;
  const built = buildKnowledgeIndex(world);
  indexCache.set(world, built);
  return built;
}

/** Applies the campaign's historical date so characters not yet born and future titles stay out of context. */
function campaignKnowledgeIndex(world: WorldData, minute: number, startYearKL = 742): KnowledgeDocument[] {
  const year = yearKLOf(minute, startYearKL);
  return cachedKnowledgeIndex(world).flatMap(doc => {
    // NPC, который ещё не родился в этой кампании, не может попасть в контекст ИИ.
    if (doc.id.startsWith("npc:")) {
      const npc = world.npcs[doc.id.slice(4)];
      if (npc?.bornAtMinute !== undefined && npc.bornAtMinute > minute) return [];
    }
    if (doc.id.startsWith("upper-society:")) {
      const personId = doc.id.slice("upper-society:".length);
      const person = UPPER_SOCIETY_ROSTER.find(item => item.id === personId);
      if (person && person.birthYear > year) return [];
      if (personId === "rey-second-prince-mother" && year < 725) {
        return [{ ...doc, text: doc.text.replace("жизненный статус не подтверждён", "жива на дату этой кампании") }];
      }
      if (personId === "rey-elin" && year < 735) {
        return [{ ...doc, text: doc.text.replace("Роль: королева", "Роль: принцесса Элиана III, супруга Гарена Вальда") }];
      }
      if (personId === "rey-consort" && year < 735) {
        return [{ ...doc, text: doc.text.replace("Роль: королевский супруг", "Роль: супруг принцессы Элианы") }];
      }
    }
    if (doc.id === "country:estran" && year < 735) {
      return [{ ...doc, text: doc.text.replace("Правитель: королева Элиана III", "Правитель: король (имя в доступной хронике не установлено); Элиана III — принцесса") }];
    }
    return [doc];
  });
}

function memoryDocument(entry: MemoryEntry, id: string, audience: "player" | "npc", ownerId: string): KnowledgeDocument {
  const heardFrom = entry.kind === "heard" && entry.source ? ` Источник слуха: ${entry.source}.` : "";
  return {
    id, title: "Воспоминание", text: `${entry.text} Тип памяти: ${entry.kind}. Уверенность: ${Math.round(entry.confidence * 100)}%.${heardFrom}${entry.eventId ? ` Событие: ${entry.eventId}.` : ""}`,
    source: id, audience, ownerId, tags: ["память", entry.kind, entry.eventId ?? ""].filter(Boolean), updatedMinute: entry.minute
  };
}

export function buildPlayerKnowledge(world: WorldData, state: GameState, query: string): string[] {
  const index = [...campaignKnowledgeIndex(world, state.minute, state.worldStartYearKL ?? 742)];
  state.playerMemory.forEach((entry, i) => index.push(memoryDocument(entry, `player-memory:${i}`, "player", "player")));
  return formatKnowledgeForPrompt(retrieveKnowledge(index, query, {
    audience: "player", limit: 6, maxCharacters: 2200, nowMinute: state.minute
  }));
}

/** NPCs receive public canon plus only their own private goal documents and memories. */
export function buildNpcKnowledge(
  world: WorldData, npcId: string, query: string, nowMinute: number, memory: MemoryEntry[] = [], startYearKL = 742
): string[] {
  const index = [...campaignKnowledgeIndex(world, nowMinute, startYearKL)];
  memory.forEach((entry, i) => index.push(memoryDocument(entry, `npc-memory:${npcId}:${i}`, "npc", npcId)));
  const npc = world.npcs[npcId];
  if (npc) index.push({
    id: `private-goals:${npcId}`, title: "Личные цели персонажа",
    text: npc.goals.join("; "), source: `world.npcs.${npcId}.goals`, audience: "npc", ownerId: npcId, tags: ["цели", "планы"]
  });
  return formatKnowledgeForPrompt(retrieveKnowledge(index, query, {
    audience: "npc", npcId, limit: 6, maxCharacters: 2200, nowMinute
  }));
}

export function knowledgeDebugSummary(world: WorldData): { documents: number; publicDocuments: number; privateDocuments: number } {
  const index = cachedKnowledgeIndex(world);
  return {
    documents: index.length,
    publicDocuments: index.filter(item => item.audience === "public").length,
    privateDocuments: Object.values(world.npcs).filter(npc => npc.goals.length > 0).length
  };
}

// Compile-time reference: retrieval is intentionally based on read-only state.
export type KnowledgeStateReference = Pick<GameState, "minute" | "playerLocation" | "playerMemory">;
