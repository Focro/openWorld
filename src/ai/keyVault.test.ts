import { describe, expect, it } from "vitest";
import { UnlockedKeySession, decryptApiKey, encryptApiKey, loadVaultRecord, passwordProblems, saveVaultRecord } from "./keyVault";
import { isSafeEndpoint } from "./proxyClient";

describe("player API key vault", () => {
  it("round-trips the key with the right password and never stores it in plain text", async () => {
    const record = await encryptApiKey("sk-test-123", "пароль12345", "anthropic");
    expect(JSON.stringify(record)).not.toContain("sk-test-123");
    expect(await decryptApiKey(record, "пароль12345")).toBe("sk-test-123");
  });
  it("fails on a wrong password or a tampered provider", async () => {
    const record = await encryptApiKey("sk-test-123", "пароль12345", "anthropic");
    await expect(decryptApiKey(record, "другой12345")).rejects.toThrow();
    await expect(decryptApiKey({ ...record, provider: "other" }, "пароль12345")).rejects.toThrow();
  });
  it("rejects weak passwords", () => {
    expect(passwordProblems("short1").length).toBeGreaterThan(0);
    expect(passwordProblems("onlyletterslong").length).toBeGreaterThan(0);
    expect(passwordProblems("letters1234")).toEqual([]);
  });
  it("storage helpers survive unavailable storage", async () => {
    const broken = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
    expect(loadVaultRecord(broken)).toBeNull();
    const record = await encryptApiKey("k", "пароль12345", "anthropic");
    expect(saveVaultRecord(record, broken)).toBe(false);
  });
  it("session never serializes the key", () => {
    const session = new UnlockedKeySession();
    session.unlock("anthropic", "sk-secret");
    expect(JSON.stringify({ session })).not.toContain("sk-secret");
    expect(session.withKey(k => k)).toBe("sk-secret");
    session.lock();
    expect(session.withKey(k => k)).toBeNull();
  });
  it("sends player keys only to https or localhost", () => {
    expect(isSafeEndpoint("https://example.org")).toBe(true);
    expect(isSafeEndpoint("http://localhost:8787")).toBe(true);
    expect(isSafeEndpoint("http://example.org")).toBe(false);
    expect(isSafeEndpoint("not a url")).toBe(false);
  });
});
