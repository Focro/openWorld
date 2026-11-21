import { describe, expect, it } from "vitest";
import {
  createUnresolvedPlayerFamilySnapshot, documentedAcknowledgedBastards, documentedDynasticOptions, evaluateSuccession,
  getCanonicalKinshipSummary, validateFamilyRecord, type CharacterFamilyRecord
} from "./family";

const base: CharacterFamilyRecord = {
  characterId: "player-1", biologicalParentIds: ["parent-a", "parent-b"], biologicalParentage: "both-known",
  legalParentIds: ["parent-a"], legalParentage: "one-known", guardianIds: ["guardian"], birthStatus: "acknowledged",
  recognitions: [{ parentId: "parent-a", recognized: true, basis: "record", year: 730 }],
  succession: { status: "undetermined", basis: "" }
};

describe("Veloria family records", () => {
  it("keeps biological parents, legal parents and guardians separate", () => {
    expect(validateFamilyRecord(base)).toEqual([]);
    expect(base.biologicalParentIds).toHaveLength(2);
    expect(base.biologicalParentage).toBe("both-known");
    expect(base.legalParentIds).not.toContain("guardian");
    expect(base.guardianIds).toContain("guardian");
  });
  it("rejects self-parenting, duplicate links and more than two biological parents", () => {
    const issues = validateFamilyRecord({ ...base, biologicalParentIds: ["player-1", "parent-a", "parent-a"] });
    expect(issues.map(issue => issue.code)).toEqual(expect.arrayContaining(["self-reference", "duplicate-link", "too-many-biological-parents"]));
  });
  it("records unresolved origins without inventing parents or guardians", () => {
    const snapshot = createUnresolvedPlayerFamilySnapshot("acknowledged-bastard", "unknown");
    expect(snapshot.resolution).toBe("unresolved");
    expect(snapshot.biologicalParentIds).toEqual([]);
    expect(snapshot.legalParentIds).toEqual([]);
    expect(snapshot.guardianIds).toEqual([]);
    expect(snapshot.succession.status).toBe("undetermined");
  });
  it("rejects contradictory parentage status and impossible family dates", () => {
    const issues = validateFamilyRecord({ ...base, biologicalParentage: "one-known", birthYear: 740, deathYear: 730, parentalUnion: { status: "married", startYear: 735, endYear: 730 } });
    expect(issues.map(issue => issue.code)).toEqual(expect.arrayContaining(["parentage-status-mismatch", "invalid-life-dates", "invalid-union-dates"]));
  });

  it("does not infer a succession right from biological descent or recognition alone", () => {
    expect(evaluateSuccession(base).status).toBe("undetermined");
  });
  it("requires explicit policy before deciding succession", () => {
    expect(evaluateSuccession(base, { allowedBirthStatuses: ["legitimate"], requiresRecognition: true, requiresBiologicalDescent: true }).status).toBe("ineligible");
    expect(evaluateSuccession(base, { allowedBirthStatuses: ["acknowledged"], requiresRecognition: true, requiresBiologicalDescent: true }).status).toBe("eligible");
  });
  it("returns only documented parent links for a known canonical member", () => {
    const summary = getCanonicalKinshipSummary("reynar", "rey-maren");
    expect(summary?.recordedParents.map(parent => parent.id)).toEqual(["rey-elin", "rey-consort"]);
    expect(summary?.succession.status).toBe("undetermined");
  });
  it("marks disputed birth legitimacy as disputed instead of treating the raw default as certain", () => {
    const summary = getCanonicalKinshipSummary("morholt", "mor-tomas");
    expect(summary?.member.legitimacyAssessment).toBe("disputed");
    expect(summary?.member.recordedLegitimacy).toBe("legitimate");
  });
  it("keeps unknown recognition separate from explicit refusal", () => {
    const unknownRecognition = evaluateSuccession({ ...base, birthStatus: "acknowledged", recognitions: [] }, {
      allowedBirthStatuses: ["acknowledged"], requiresRecognition: true, requiresBiologicalDescent: true
    });
    expect(unknownRecognition.status).toBe("undetermined");
    const refused = evaluateSuccession({ ...base, birthStatus: "acknowledged", recognitions: [
      { parentId: "parent-a", recognized: false, basis: "court" },
      { parentId: "parent-b", recognized: false, basis: "court" }
    ] }, { allowedBirthStatuses: ["acknowledged"], requiresRecognition: true, requiresBiologicalDescent: true });
    expect(refused.status).toBe("ineligible");
  });
  it("requires legal parentage only when a law explicitly demands it", () => {
    const unknownLegal = evaluateSuccession(base, {
      allowedBirthStatuses: ["acknowledged"], requiresRecognition: true, requiresBiologicalDescent: true, requiresLegalParentage: true
    });
    expect(unknownLegal.status).toBe("undetermined");
    const legalConfirmed = evaluateSuccession({ ...base, legalParentage: "one-known", legalParentIds: ["parent-a"] }, {
      allowedBirthStatuses: ["acknowledged"], requiresRecognition: true, requiresBiologicalDescent: true, requiresLegalParentage: true, minimumLegalParents: 1
    });
    expect(legalConfirmed.status).toBe("eligible");
  });
  it("does not treat a biological parent outside the permitted dynasty as eligible", () => {
    const result = evaluateSuccession(base, {
      allowedBirthStatuses: ["acknowledged"], requiresRecognition: true, requiresBiologicalDescent: true,
      eligibleBiologicalParentIds: ["another-house-parent"]
    });
    expect(result.status).toBe("ineligible");
  });
  it("lists only documented acknowledged children and invents none", () => {
    // С 0.12.0 в реестре есть ровно один признанный ребёнок — второй принц дома Рейнар.
    const documented = documentedAcknowledgedBastards();
    expect(documented.map(item => item.member.id)).toEqual(["rey-second-prince"]);
  });
  it("lists existing heir-role members as reference only", () => {
    const options = documentedDynasticOptions("heir");
    expect(options.some(option => option.houseId === "reynar" && option.memberIds.includes("rey-oren"))).toBe(true);
  });
});
