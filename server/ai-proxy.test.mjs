import { test } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter, extractProposal, validateEnvelope } from "./ai-proxy.mjs";

test("rate limiter blocks bursts and daily overuse", () => {
  let t = 0; const allow = createRateLimiter({ perMinute: 2, perDay: 3 }, () => t);
  assert.equal(allow("a").ok, true); assert.equal(allow("a").ok, true); assert.equal(allow("a").ok, false);
  t = 61_000; assert.equal(allow("a").ok, true); t = 122_000; assert.equal(allow("a").ok, false);
  assert.equal(allow("b").ok, true);
});
test("envelope validation rejects foreign payloads", () => {
  assert.ok(validateEnvelope({}));
  assert.ok(validateEnvelope({ envelope: { protocol: "x" } }));
  assert.equal(validateEnvelope({ envelope: { protocol: "openworld-ai-context-v1", playerText: "осмотреться", systemInstructions: [], context: {}, outputContract: { allowedActions: ["look"] } } }), null);
});
test("proposal extraction ignores surrounding text", () => {
  assert.deepEqual(extractProposal('Вот: {"type":"infant","act":"cry"} готово'), { type: "infant", act: "cry" });
  assert.equal(extractProposal("нет json"), null);
});

import { PROVIDERS, buildChatCompletionsRequest, callProvider, resolveTarget } from "./ai-proxy.mjs";
const envelope = { protocol: "openworld-ai-context-v1", playerText: "осмотреться", systemInstructions: ["Ты рассказчик."], context: { a: 1 }, outputContract: { allowedActions: ["look"] } };

test("provider resolution: server key, player key, model override only with own key", () => {
  assert.equal(resolveTarget({ "x-ai-provider": "nope" }, {}).status, 400);
  assert.equal(resolveTarget({ "x-ai-provider": "deepseek" }, {}).status, 503);
  const server = resolveTarget({ "x-ai-provider": "deepseek", "x-ai-model": "expensive-model" }, { DEEPSEEK_API_KEY: "srv" });
  assert.equal(server.apiKey, "srv"); assert.equal(server.model, "deepseek-chat");
  const own = resolveTarget({ "x-ai-provider": "openrouter", "x-player-api-key": "mine", "x-ai-model": "vendor/model-1" }, {});
  assert.equal(own.apiKey, "mine"); assert.equal(own.model, "vendor/model-1");
  assert.equal(resolveTarget({ "x-ai-provider": "openai", "x-player-api-key": "mine" }, {}).status, 503);
  assert.equal(resolveTarget({ "x-ai-provider": "openai", "x-player-api-key": "mine", "x-ai-model": "bad model!" }, {}).status, 400);
  assert.equal(resolveTarget({ "x-ai-provider": "anthropic", "x-player-api-key": "mine" }, {}, false).status, 503);
  assert.equal(resolveTarget({ "x-ai-provider": "__proto__" }, {}).status, 400);
});

test("openai-compatible providers: request shape and response parsing", async () => {
  const target = { providerId: "openai", provider: PROVIDERS.openai, apiKey: "k", model: "m" };
  const body = buildChatCompletionsRequest(target, envelope);
  assert.equal(body.max_completion_tokens, 200); assert.equal(body.messages[0].role, "system");
  assert.equal(buildChatCompletionsRequest({ ...target, provider: PROVIDERS.deepseek }, envelope).max_tokens, 200);
  let seen;
  const ok = await callProvider({ ...target, provider: PROVIDERS.deepseek }, envelope, async (url, init) => {
    seen = { url, auth: init.headers.Authorization };
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ok {"type":"look"}' }, finish_reason: "stop" }], usage: { prompt_tokens: 5, completion_tokens: 2 } }), { status: 200 });
  });
  assert.equal(seen.url, "https://api.deepseek.com/chat/completions"); assert.equal(seen.auth, "Bearer k");
  assert.equal(ok.text, 'ok {"type":"look"}'); assert.deepEqual(ok.usage, { input: 5, output: 2 });
  assert.equal((await callProvider(target, envelope, async () => new Response("{}", { status: 401 }))).status, 401);
  assert.equal((await callProvider(target, envelope, async () => new Response("{}", { status: 503 }))).status, 502);
  assert.equal((await callProvider(target, envelope, async () => { throw new Error("net"); })).status, 502);
  const filtered = await callProvider(target, envelope, async () => new Response(JSON.stringify({ choices: [{ message: { content: "" }, finish_reason: "content_filter" }] }), { status: 200 }));
  assert.equal(filtered.refused, true);
});

test("accepts the compact intent protocol and keeps the system prompt short", async () => {
  const { buildSystemPrompt } = await import("./ai-proxy.mjs");
  const intent = { protocol: "openworld-intent-v1", playerText: "иду на рынок", systemInstructions: ["коротко"], context: { acts: ["move"] }, outputContract: { allowedActions: ["move"] } };
  assert.equal(validateEnvelope({ envelope: intent }), null);
  assert.ok(buildSystemPrompt(intent).length < 300);
});
