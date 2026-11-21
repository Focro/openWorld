import { COUNTRIES, MAP_NODES, REGIONS, ROUTES } from "./atlas";
import { CONTINENTS } from "./continents";
import { FAITHS } from "./faiths";
import { HIDDEN_ACTORS } from "./hiddenActors";
import { NOBLE_HOUSES } from "./nobleHouses";
import { INSTITUTIONS } from "./institutions";
import { SECRET_CULTS } from "./cults";
import { BLACK_MARKETS } from "./blackMarkets";
import { RARE_PEOPLES } from "./peoples";
import { RARE_INDIVIDUALS } from "./rareIndividuals";

/** Текущий год канона (Библия, раздел 2). */
export const CANON_CURRENT_YEAR = 742;

export type IssueCategory =
  | "id-mismatch" | "dangling-ref" | "id-collision"
  | "founder-alive" | "parent-gap" | "founding-date" | "spouse" | "routes" | "duplicate-id";

export interface CanonIssue { category: IssueCategory; message: string }

/**
 * Проверка целостности данных Велории. Ничего не исправляет: только сообщает.
 * Отсутствие замечаний не доказывает согласованность с литературным каноном (Библией).
 */
export function checkCanon(): CanonIssue[] {
  const issues: CanonIssue[] = [];
  const add = (category: IssueCategory, message: string) => issues.push({ category, message });

  const countryIds = new Set(COUNTRIES.map((c) => c.id));
  const nodeIds = new Set(MAP_NODES.map((n) => n.id));
  const houseIds = new Set(NOBLE_HOUSES.map((h) => h.id));
  const institutionIds = new Set(INSTITUTIONS.map((x) => x.id));
  const faithIds = new Set(FAITHS.map((f) => f.id));

  for (const c of CONTINENTS) for (const s of c.knownStates)
    if (!countryIds.has(s)) add("id-mismatch", `continents: государство «${s}» (континент ${c.id}) отсутствует в атласе`);
  for (const h of NOBLE_HOUSES)
    if (!countryIds.has(h.stateId)) add("id-mismatch", `дом ${h.id}: государство «${h.stateId}» отсутствует в атласе`);
  for (const f of FAITHS) for (const r of f.regions)
    if (!countryIds.has(r)) add("id-mismatch", `вера ${f.id}: «${r}» отсутствует среди государств`);
  for (const c of COUNTRIES)
    if (!faithIds.has(c.primaryFaith)) add("id-mismatch", `страна ${c.id}: вера «${c.primaryFaith}» не найдена`);
  for (const institution of INSTITUTIONS)
    if (!countryIds.has(institution.countryId)) add("id-mismatch", `учреждение ${institution.id}: государство «${institution.countryId}» не найдено`);
  for (const r of REGIONS)
    if (!countryIds.has(r.countryId)) add("id-mismatch", `регион ${r.id}: страна «${r.countryId}» не найдена`);
  for (const n of MAP_NODES) {
    const reg = REGIONS.find((r) => r.id === n.regionId);
    if (!reg || reg.countryId !== n.countryId) add("id-mismatch", `узел ${n.id}: регион ${n.regionId} не принадлежит стране ${n.countryId}`);
  }
  for (const c of COUNTRIES)
    if (!MAP_NODES.some((n) => n.id === c.capital && n.countryId === c.id)) add("id-mismatch", `страна ${c.id}: столица «${c.capital}» не найдена среди узлов карты`);
  for (const a of HIDDEN_ACTORS) {
    const n = MAP_NODES.find((x) => x.id === a.startingNodeId);
    if (!n) add("id-mismatch", `скрытая фигура ${a.id}: нет узла ${a.startingNodeId}`);
    else if (n.countryId !== a.countryId) add("id-mismatch", `скрытая фигура ${a.id}: узел ${n.id} принадлежит другой стране`);
  }

  for (const h of NOBLE_HOUSES) {
    for (const k of [...h.allies, ...h.rivals])
      if (!houseIds.has(k) && !institutionIds.has(k)) add("dangling-ref", `дом ${h.id} ссылается на «${k}»: такой дом или институт не зарегистрирован`);
    if (nodeIds.has(h.id)) add("id-collision", `id дома «${h.id}» совпадает с id города`);
    // Связи записаны с точки зрения конкретного дома; отсутствие обратной записи не доказывает взаимный союз.
  }

  const people = new Map<string, { house: string; birth: number; death?: number; status: string; parents: string[]; spouses: string[]; name: string }>();
  for (const h of NOBLE_HOUSES) for (const m of h.members) {
    if (people.has(m.id)) add("duplicate-id", `id члена дома «${m.id}» повторяется`);
    people.set(m.id, { house: h.id, birth: m.birthYear, death: m.deathYear, status: m.status, parents: m.parentIds, spouses: m.spouseIds, name: m.name });
  }
  for (const [id, m] of people) {
    if (m.status === "alive" && CANON_CURRENT_YEAR - m.birth > 100)
      add("founder-alive", `${id} (${m.name}): отмечен живым, возраст ${CANON_CURRENT_YEAR - m.birth} лет`);
    for (const p of m.parents) {
      const parent = people.get(p);
      if (!parent) continue;
      const gap = m.birth - parent.birth;
      if (gap < 14 || gap > 60) add("parent-gap", `${id} (род. ${m.birth}) ← родитель ${p} (род. ${parent.birth}): разница ${gap} лет`);
    }
    for (const s of m.spouses) {
      const sp = people.get(s);
      if (sp && !sp.spouses.includes(id)) add("spouse", `${id} → супруг ${s}, но не взаимно`);
    }
  }
  for (const h of NOBLE_HOUSES) {
    const founder = h.members.find(m => m.name === h.founder);
    if (founder && founder.birthYear > h.foundedYear)
      add("founding-date", `дом ${h.id}: основатель ${founder.id} родился после даты основания ${h.foundedYear}`);
  }

  const seen = new Set<string>();
  for (const r of ROUTES) {
    if (!nodeIds.has(r.from) || !nodeIds.has(r.to)) add("routes", `маршрут ${r.from}→${r.to}: узел отсутствует`);
    const key = [r.from, r.to].sort().join("|");
    if (seen.has(key)) add("routes", `дубль маршрута ${key}`);
    seen.add(key);
  }
  const adj = new Map<string, string[]>();
  for (const r of ROUTES) {
    adj.set(r.from, [...(adj.get(r.from) ?? []), r.to]);
    adj.set(r.to, [...(adj.get(r.to) ?? []), r.from]);
  }
  const reach = new Set<string>(["roven"]);
  const queue = ["roven"];
  while (queue.length) for (const n of adj.get(queue.shift()!) ?? []) if (!reach.has(n)) { reach.add(n); queue.push(n); }
  for (const n of MAP_NODES) if (!reach.has(n.id)) add("routes", `узел ${n.id} недостижим из Ровена`);

  const cultIds = new Set(SECRET_CULTS.map(x => x.id));
  for (const cult of SECRET_CULTS) {
    if (!countryIds.has(cult.countryId)) add("id-mismatch", `культ ${cult.id}: государство ${cult.countryId} не найдено`);
    for (const regionId of cult.operatingRegions)
      if (!REGIONS.some(r => r.id === regionId && cult.operatingCountries.includes(r.countryId)))
        add("id-mismatch", `культ ${cult.id}: регион ${regionId} не найден среди мест деятельности`);
  }
  for (const market of BLACK_MARKETS) {
    const node = MAP_NODES.find(n => n.id === market.nodeId);
    if (!node || node.countryId !== market.countryId)
      add("id-mismatch", `чёрный рынок ${market.id}: узел ${market.nodeId} не найден в ${market.countryId}`);
    for (const cultId of market.connectedCultIds)
      if (!cultIds.has(cultId)) add("dangling-ref", `чёрный рынок ${market.id}: культ ${cultId} не зарегистрирован`);
  }
  const peopleIds = new Set(RARE_PEOPLES.map(x => x.id));
  for (const people of RARE_PEOPLES) for (const regionId of people.knownRegions)
    if (!REGIONS.some(r => r.id === regionId))
      add("id-mismatch", `народ/состояние ${people.id}: регион ${regionId} не найден`);
  for (const person of RARE_INDIVIDUALS) {
    if (!peopleIds.has(person.speciesId)) add("dangling-ref", `редкая фигура ${person.id}: тип ${person.speciesId} не зарегистрирован`);
    if (!MAP_NODES.some(n => n.id === person.homeNodeId)) add("id-mismatch", `редкая фигура ${person.id}: узел ${person.homeNodeId} не найден`);
  }

  return issues;
}

export const issuesBy = (issues: CanonIssue[], category: IssueCategory) => issues.filter((i) => i.category === category);
