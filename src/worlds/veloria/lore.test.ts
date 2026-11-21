import { describe, expect, it } from "vitest";
import { VELORIA_CANON } from "./lore";

describe("Roven local chronology", () => {
  it("uses local year zero as 742 KL", () => {
    expect(VELORIA_CANON.calendar.currentYearKL).toBe(742);
    expect(VELORIA_CANON.calendar.localYearOffset).toBe(742);
  });

  it("maps every local event to the shared calendar", () => {
    for (const event of VELORIA_CANON.history) {
      expect(event.yearKL).toBe(event.year + VELORIA_CANON.calendar.localYearOffset);
    }
    expect(VELORIA_CANON.history.find(x => x.title === "Основание Ровена")!.yearKL).toBe(659);
    expect(VELORIA_CANON.history.find(x => x.title === "Городская хартия")!.yearKL).toBe(701);
    expect(VELORIA_CANON.history.find(x => x.title === "Война трёх вассалов")!.yearKL).toBe(730);
    expect(VELORIA_CANON.history.find(x => x.title === "Восшествие Элианы III")!.yearKL).toBe(735);
  });
});
