import { describe, expect, it } from "vitest";
import { readAutosave, writeAutosave, AUTOSAVE_KEY } from "./autosave";
import type { GameState } from "../engine/types";

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } }; };

describe("автосохранение", () => {
  it("сохраняет только кампанию с героем и читает её обратно", () => {
    const s = memory();
    expect(writeAutosave("veloria", { playerName: "x" } as unknown as GameState, s).ok).toBe(false);
    const info = writeAutosave("veloria", { playerName: "Лиан", playerProfile: { age: 0 } } as unknown as GameState, s);
    expect(info.ok).toBe(true);
    expect(JSON.parse(readAutosave(s)!).game.playerName).toBe("Лиан");
    expect(s.getItem(AUTOSAVE_KEY)).not.toBeNull();
    writeAutosave("demo", { playerName: "Другой", playerProfile: { age: 3 } } as unknown as GameState, s);
    expect(JSON.parse(readAutosave(s, "veloria")!).game.playerName).toBe("Лиан");
    expect(JSON.parse(readAutosave(s)!).game.playerName).toBe("Другой");
    expect(readAutosave(s, "elsewhere")).toBeNull();
  });
  it("не падает, если места нет", () => {
    const full = { getItem: () => null, setItem: () => { throw new Error("QuotaExceeded"); }, removeItem: () => undefined };
    expect(writeAutosave("veloria", { playerProfile: {} } as unknown as GameState, full).ok).toBe(false);
  });
});
