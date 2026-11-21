import { describe, expect, it } from "vitest";
import { friendlyError, getCloudKey, MAX_CLOUD_SAVE_CHARS, putCloudKey, putCloudSave, reportChildSafetyStrike, type Cloud } from "./account";
import { encryptApiKey } from "../ai/keyVault";

/** Маленький поддельный клиент: запоминает, что ушло в базу, и отдаёт заданный ответ. */
function fakeCloud(answer: { data?: unknown; error?: unknown } = {}) {
  const calls: Array<{ table?: string; op: string; args: unknown[] }> = [];
  const result = { data: answer.data ?? null, error: answer.error ?? null };
  const chain = (table: string): Record<string, unknown> => {
    const q: Record<string, unknown> = {};
    for (const op of ["select", "upsert", "update", "delete", "eq", "order", "limit", "maybeSingle"]) q[op] = (...args: unknown[]) => { calls.push({ table, op, args }); return q; };
    q.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(result).then(ok, bad);
    return q;
  };
  const cloud = { from: (table: string) => chain(table), rpc: (name: string, args: unknown) => { calls.push({ op: `rpc:${name}`, args: [args] }); return Promise.resolve(result); } } as unknown as Cloud;
  return { cloud, calls };
}

describe("облако: аккаунт, сохранения, ключ, защита", () => {
  it("переводит ошибки базы на понятный язык", () => {
    expect(friendlyError({ message: "birth_date_locked" })).toMatch(/только один раз/);
    expect(friendlyError({ message: "adult_mode_requires_18" })).toMatch(/18 лет/);
    expect(friendlyError(new Error("Failed to fetch"))).toMatch(/Нет связи/);
    expect(friendlyError({ message: "new row violates check constraint \"api_keys_ciphertext_check\"" })).toMatch(/зашифрован/);
  });

  it("пишет сохранение в слот с upsert по пользователю, миру и слоту", async () => {
    const { cloud, calls } = fakeCloud();
    await putCloudSave(cloud, "veloria", "auto", JSON.stringify({ schemaVersion: 1, worldId: "veloria", game: { minute: 5 } }));
    const up = calls.find(c => c.op === "upsert")!;
    expect(up.table).toBe("saves");
    expect(up.args[0]).toMatchObject({ world_id: "veloria", slot: "auto", data: { game: { minute: 5 } } });
    expect(up.args[1]).toEqual({ onConflict: "user_id,world_id,slot" });
    await expect(putCloudSave(cloud, "veloria", "auto", `"${"x".repeat(MAX_CLOUD_SAVE_CHARS)}"`)).rejects.toThrow(/слишком большое/);
  });

  it("отправляет в облако только шифротекст ключа, без пароля и открытого ключа", async () => {
    const { cloud, calls } = fakeCloud();
    const record = await encryptApiKey("sk-secret-test-key-123", "пароль12345", "anthropic");
    await putCloudKey(cloud, record);
    const sent = JSON.stringify(calls);
    expect(sent).not.toMatch(/sk-secret|пароль12345/);
    expect(calls.find(c => c.op === "upsert")!.args[0]).toMatchObject({ provider: "anthropic", ciphertext: record.ciphertext, iterations: record.iterations });
    expect(record.ciphertext).toMatch(/^[A-Za-z0-9+/=]{24,}$/);
  });

  it("читает ключ из облака в формате хранилища браузера", async () => {
    const row = { provider: "openai", version: 1, salt: "c2FsdHNhbHRzYWx0c2FsdA==", iv: "aXZpdml2aXZpdml2", ciphertext: "Y2lwaGVydGV4dGNpcGhlcnRleHQ=", iterations: 310000, created_at: "2026-11-21T10:00:00Z" };
    const { cloud } = fakeCloud({ data: [row] });
    expect(await getCloudKey(cloud)).toEqual({ version: 1, provider: "openai", salt: row.salt, iv: row.iv, ciphertext: row.ciphertext, iterations: 310000, createdAt: row.created_at });
  });

  it("предупреждение уходит в функцию базы, бан приходит оттуда", async () => {
    const { cloud, calls } = fakeCloud({ data: [{ strikes: 4, banned: true }] });
    expect(await reportChildSafetyStrike(cloud, "child-safety")).toEqual({ strikes: 4, banned: true });
    expect(calls[0]).toEqual({ op: "rpc:report_child_safety_strike", args: [{ reason: "child-safety" }] });
  });
});
