import { NOBLE_HOUSES, houseById, type DynasticHouse, type GenealogyMember } from "./nobleHouses";

/**
 * Семейные связи игрока. Биологическое родство, юридическое родительство,
 * опека, признание и право наследования хранятся раздельно.
 * Значение "undetermined" обязательно, если закон/факт не подтверждён каноном.
 */
export type BirthStatus = "legitimate" | "acknowledged" | "unrecognized" | "unknown" | "adopted";
export type SuccessionStatus = "eligible" | "ineligible" | "undetermined";

export interface RecognitionRecord {
  parentId: string;
  recognized: boolean;
  basis: "record" | "decree" | "court" | "custom" | "unknown";
  year?: number;
}

export interface CharacterFamilyRecord {
  characterId: string;
  /** Только подтверждённые биологические связи. Неизвестные родители отсутствуют в массиве. */
  biologicalParentIds: string[];
  biologicalParentage: "both-known" | "one-known" | "unknown";
  birthYear?: number;
  deathYear?: number;
  parentalUnion?: {
    status: "married" | "unmarried" | "unknown";
    startYear?: number;
    endYear?: number;
  };
  /** Юридические родители могут отличаться от биологических. */
  legalParentIds: string[];
  legalParentage: "both-known" | "one-known" | "unknown";
  /** Опекуны и воспитатели не становятся родителями автоматически. */
  guardianIds: string[];
  birthStatus: BirthStatus;
  recognitions: RecognitionRecord[];
  succession: {
    status: SuccessionStatus;
    houseId?: string;
    basis: string;
  };
}


export interface UnresolvedPlayerFamilySnapshot {
  resolution: "unresolved";
  biologicalParentage: "unknown";
  biologicalParentIds: [];
  legalParentIds: [];
  legalParentage: "unknown";
  guardianIds: [];
  recognition: "not-established";
  succession: { status: "undetermined"; reason: string };
  familyState: string;
  originId: string;
}

/** Честная запись для сохранения, пока симуляция ещё не назначила конкретную семью. */
export function createUnresolvedPlayerFamilySnapshot(
  originId: string, familyState: string
): UnresolvedPlayerFamilySnapshot {
  return {
    resolution: "unresolved",
    biologicalParentage: "unknown",
    biologicalParentIds: [],
    legalParentIds: [],
    legalParentage: "unknown",
    guardianIds: [],
    recognition: "not-established",
    succession: { status: "undetermined", reason: "Семья персонажа ещё не назначена симуляцией; право наследования не установлено." },
    familyState,
    originId
  };
}

export interface SuccessionPolicy {
  /** Политика должна быть явно внесена для конкретного дома/института. */
  allowedBirthStatuses: BirthStatus[];
  requiresRecognition: boolean;
  requiresBiologicalDescent: boolean;
  /** Если происхождение должно идти от конкретной династической линии. */
  eligibleBiologicalParentIds?: string[];
  /** Некоторые законы отдельно требуют доказанного юридического родительства. */
  requiresLegalParentage?: boolean;
  minimumLegalParents?: 1 | 2;
}

export interface FamilyValidationIssue {
  code: "self-reference" | "duplicate-link" | "too-many-biological-parents" | "invalid-recognition" | "invalid-succession" | "parentage-status-mismatch" | "invalid-life-dates" | "invalid-union-dates";
  message: string;
}

export interface CanonicalKinshipSummary {
  houseId: string;
  houseName: string;
  member: Pick<GenealogyMember, "id" | "name" | "birthYear" | "status" | "role" | "notes"> & {
    recordedLegitimacy: GenealogyMember["legitimacy"];
    legitimacyAssessment: "recorded" | "disputed";
  };
  /** В текущем реестре это записанные родительские связи; их юридическая сила отдельно не выводится. */
  recordedParents: Array<Pick<GenealogyMember, "id" | "name" | "role" | "birthYear" | "status">>;
  recordedAncestors: Array<Pick<GenealogyMember, "id" | "name" | "role" | "birthYear" | "status">>;
  inheritanceLaw: string;
  succession: { status: "undetermined"; reason: string };
}

export function validateFamilyRecord(record: CharacterFamilyRecord): FamilyValidationIssue[] {
  const issues: FamilyValidationIssue[] = [];
  const groups = [record.biologicalParentIds, record.legalParentIds, record.guardianIds];
  if (groups.some(ids => ids.includes(record.characterId))) {
    issues.push({ code: "self-reference", message: "Персонаж не может быть собственным родителем или опекуном." });
  }
  for (const ids of groups) {
    if (new Set(ids).size !== ids.length) {
      issues.push({ code: "duplicate-link", message: "Одна и та же семейная связь указана несколько раз." });
      break;
    }
  }
  if (record.biologicalParentIds.length > 2) {
    issues.push({ code: "too-many-biological-parents", message: "Для этой модели можно указать не более двух биологических родителей." });
  }
  const expectedParentCount = record.biologicalParentage === "both-known" ? 2 : record.biologicalParentage === "one-known" ? 1 : 0;
  if (record.biologicalParentIds.length !== expectedParentCount) {
    issues.push({ code: "parentage-status-mismatch", message: "Степень известности биологического происхождения не совпадает с количеством подтверждённых родителей." });
  }
  const expectedLegalCount = record.legalParentage === "both-known" ? 2 : record.legalParentage === "one-known" ? 1 : 0;
  if (record.legalParentIds.length !== expectedLegalCount) {
    issues.push({ code: "parentage-status-mismatch", message: "Степень известности юридического родительства не совпадает с количеством подтверждённых юридических родителей." });
  }
  if (record.birthYear !== undefined && record.deathYear !== undefined && record.deathYear < record.birthYear) {
    issues.push({ code: "invalid-life-dates", message: "Дата смерти не может предшествовать дате рождения." });
  }
  if (record.parentalUnion?.startYear !== undefined && record.parentalUnion?.endYear !== undefined && record.parentalUnion.endYear < record.parentalUnion.startYear) {
    issues.push({ code: "invalid-union-dates", message: "Окончание брака не может предшествовать его началу." });
  }
  const biological = new Set(record.biologicalParentIds);
  if (record.recognitions.some(item => !biological.has(item.parentId))) {
    issues.push({ code: "invalid-recognition", message: "Признание происхождения может относиться только к указанному биологическому родителю." });
  }
  if (record.succession.status !== "undetermined" && !record.succession.basis.trim()) {
    issues.push({ code: "invalid-succession", message: "Подтверждённое право или запрет наследования требует указания правового основания." });
  }
  return issues;
}

/** Оценивает наследование только по явно заданному правилу; текст закона не парсится наугад. */
export function evaluateSuccession(
  record: CharacterFamilyRecord,
  policy?: SuccessionPolicy
): { status: SuccessionStatus; reason: string } {
  if (!policy) return { status: "undetermined", reason: "Для этого дома ещё не внесено формализованное правило престолонаследия." };
  if (record.birthStatus === "unknown") {
    return { status: "undetermined", reason: "Правовой статус рождения не установлен документами." };
  }
  if (!policy.allowedBirthStatuses.includes(record.birthStatus)) {
    return { status: "ineligible", reason: "Статус рождения не допускается явно заданным правилом наследования." };
  }
  if (policy.requiresBiologicalDescent) {
    if (record.biologicalParentage === "unknown" || record.biologicalParentIds.length === 0) {
      return { status: "undetermined", reason: "Биологическое происхождение не подтверждено." };
    }
    if (policy.eligibleBiologicalParentIds?.length && !record.biologicalParentIds.some(id => policy.eligibleBiologicalParentIds!.includes(id))) {
      return { status: "ineligible", reason: "Подтверждённое биологическое происхождение не ведёт к линии, допускаемой этим правилом." };
    }
  }
  if (policy.requiresLegalParentage) {
    const minimum = policy.minimumLegalParents ?? 2;
    if (record.legalParentage === "unknown" || record.legalParentIds.length < minimum) {
      return { status: "undetermined", reason: "Юридическое родительство подтверждено не полностью для требования этого правила." };
    }
  }
  if (policy.requiresRecognition) {
    const recognized = record.recognitions.some(item => item.recognized && record.biologicalParentIds.includes(item.parentId));
    if (!recognized) {
      const explicitlyDeniedForAllKnownParents = record.biologicalParentIds.length > 0 && record.biologicalParentIds.every(parentId =>
        record.recognitions.some(item => item.parentId === parentId && !item.recognized)
      );
      if (record.birthStatus === "unrecognized" || explicitlyDeniedForAllKnownParents) {
        return { status: "ineligible", reason: "Документы прямо указывают, что происхождение не признано." };
      }
      return { status: "undetermined", reason: "Требуемое признание не подтверждено и не опровергнуто документами." };
    }
  }
  return { status: "eligible", reason: "Условия внесённого правила выполнены; окончательное решение института может требовать отдельного утверждения." };
}

/** Получает только уже записанные в каноне родственные связи конкретного члена дома. */
export function getCanonicalKinshipSummary(houseId: string, memberId: string): CanonicalKinshipSummary | null {
  const house = houseById(houseId);
  const member = house?.members.find(item => item.id === memberId);
  if (!house || !member) return null;
  const byId = new Map(house.members.map(item => [item.id, item]));
  const project = (id: string) => {
    const person = byId.get(id);
    return person ? { id: person.id, name: person.name, role: person.role, birthYear: person.birthYear, status: person.status } : null;
  };
  return {
    houseId: house.id,
    houseName: house.name,
    member: {
      id: member.id, name: member.name, birthYear: member.birthYear, status: member.status, role: member.role, notes: member.notes,
      recordedLegitimacy: member.legitimacy,
      legitimacyAssessment: /оспаривается|под сомнением|предполагаем/i.test(member.notes) ? "disputed" : "recorded"
    },
    recordedParents: member.parentIds.map(project).filter((x): x is NonNullable<typeof x> => x !== null),
    recordedAncestors: member.ancestorIds.map(project).filter((x): x is NonNullable<typeof x> => x !== null),
    inheritanceLaw: house.inheritanceLaw,
    succession: { status: "undetermined", reason: "В реестре есть текст закона дома, но нет проверенного формального решения о праве этого человека на наследование." }
  };
}

/** Возвращает только дома с документированными членами подходящей социальной роли. */
export function documentedDynasticOptions(kind: "heir" | "noble"): Array<{ houseId: string; houseName: string; memberIds: string[] }> {
  return NOBLE_HOUSES.map((house: DynasticHouse) => {
    const members = house.members.filter(member => {
      const role = member.role.toLocaleLowerCase("ru-RU");
      return kind === "heir"
        ? /наследник|наследница|принц|принцесса|султан|император|королева|король/.test(role)
        : member.legitimacy === "legitimate";
    });
    return { houseId: house.id, houseName: house.name, memberIds: members.map(member => member.id) };
  }).filter(item => item.memberIds.length > 0);
}

/** Удобная проверка: наличие записи о признанном бастарде не выводится из титула или слуха. */
export function documentedAcknowledgedBastards(): CanonicalKinshipSummary[] {
  const result: CanonicalKinshipSummary[] = [];
  // Только канон: дома-предложения не считаются документированными записями.
  for (const house of NOBLE_HOUSES.filter(h => h.canonStatus !== "proposal")) {
    for (const member of house.members) {
      if (member.legitimacy !== "acknowledged") continue;
      const summary = getCanonicalKinshipSummary(house.id, member.id);
      if (summary) result.push(summary);
    }
  }
  return result;
}
