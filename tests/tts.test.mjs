// Node 24+: node --test tests/tts.test.mjs
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { after, afterEach, beforeEach, mock, test } from "node:test";

const root = new URL("../", import.meta.url);
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) return nextResolve(new URL(`${specifier.slice(2)}.ts`, root).href, context);
  return nextResolve(specifier, context);
} });
const { POST } = await import(new URL("app/api/tts/route.ts", root).href);
const oldKey = process.env.ELEVENLABS_API_KEY;
const oldModel = process.env.ELEVENLABS_MODEL;
let fetchMock;
const payload = { text: "Walk me through your approach.", voiceId: "JBFqnCBsd6RMkjVDRZzb" };
const audio = () => new Response(new Uint8Array([73, 68, 51, 1, 2, 3]), {
  headers: { "Content-Type": "audio/mpeg", "x-provider-secret": "private" },
});
function request(data = payload, signal) {
  return new Request("http://localhost/api/tts", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), signal,
  });
}
beforeEach(() => {
  process.env.ELEVENLABS_API_KEY = "test-placeholder";
  delete process.env.ELEVENLABS_MODEL;
  fetchMock = mock.method(globalThis, "fetch", async () => audio());
});
afterEach(() => mock.restoreAll());
after(() => {
  if (oldKey === undefined) delete process.env.ELEVENLABS_API_KEY;
  else process.env.ELEVENLABS_API_KEY = oldKey;
  if (oldModel === undefined) delete process.env.ELEVENLABS_MODEL;
  else process.env.ELEVENLABS_MODEL = oldModel;
});

test("returns MP3 bytes and sends the selected voice, trimmed text, and server key", async () => {
  const res = await POST(request({ ...payload, text: ` ${payload.text} `, apiKey: "untrusted", model_id: "untrusted" }));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "audio/mpeg");
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(res.headers.get("x-provider-secret"), null);
  assert.deepEqual(new Uint8Array(await res.arrayBuffer()), new Uint8Array([73, 68, 51, 1, 2, 3]));
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, `https://api.elevenlabs.io/v1/text-to-speech/${payload.voiceId}/stream?output_format=mp3_44100_128`);
  assert.equal(options.headers["xi-api-key"], "test-placeholder");
  assert.equal(options.redirect, "error");
  assert.deepEqual(JSON.parse(options.body), { text: payload.text, model_id: "eleven_multilingual_v2" });
});

test("uses the server model override", async () => {
  process.env.ELEVENLABS_MODEL = "eleven_flash_v2_5";
  const res = await POST(request());
  await res.body.cancel();
  assert.equal(JSON.parse(fetchMock.mock.calls[0].arguments[1].body).model_id, "eleven_flash_v2_5");
});

test("rejects invalid input before a paid provider request", async () => {
  for (const data of [null, {}, { ...payload, text: " " }, { ...payload, text: "x".repeat(2401) },
    { ...payload, voiceId: "../other?key=secret" }, { ...payload, voiceId: "" }, { ...payload, text: 42 }]) {
    assert.equal((await POST(request(data))).status, 400);
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("rejects malformed JSON and unsupported content types", async () => {
  assert.equal((await POST(new Request("http://localhost/api/tts", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{",
  }))).status, 400);
  assert.equal((await POST(new Request("http://localhost/api/tts", {
    method: "POST", body: "hello",
  }))).status, 415);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("bounds streamed request size without requiring Content-Length", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(c) { c.enqueue(new Uint8Array(32769)); },
    cancel() { cancelled = true; },
  });
  const res = await POST(new Request("http://localhost/api/tts", {
    method: "POST", headers: { "Content-Type": "application/json" }, body, duplex: "half",
  }));
  assert.equal(res.status, 413);
  assert.equal(cancelled, true);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("reports a missing server key without calling ElevenLabs", async () => {
  delete process.env.ELEVENLABS_API_KEY;
  assert.equal((await POST(request())).status, 503);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("maps provider failures and never leaks provider response bodies", async () => {
  for (const [upstream, expected] of [[401, 503], [403, 503], [404, 400], [422, 502], [500, 502], [429, 429]]) {
    fetchMock.mock.mockImplementation(async () => new Response("SECRET provider account details", {
      status: upstream, headers: { "Retry-After": "12" },
    }));
    const res = await POST(request());
    assert.equal(res.status, expected);
    assert.equal(res.headers.get("retry-after"), upstream === 429 ? "12" : null);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.doesNotMatch(body.reason, /SECRET/);
  }
});

test("rejects a successful non-audio response", async () => {
  fetchMock.mock.mockImplementation(async () => Response.json({ secret: "private" }));
  assert.equal((await POST(request())).status, 502);
});

test("handles network failures, timeouts, and client aborts", async () => {
  fetchMock.mock.mockImplementation(async () => { throw new Error("SECRET network details"); });
  assert.equal((await POST(request())).status, 502);
  fetchMock.mock.mockImplementation(async () => { throw new DOMException("Timed out", "TimeoutError"); });
  assert.equal((await POST(request())).status, 504);
  const controller = new AbortController();
  controller.abort();
  fetchMock.mock.mockImplementation(async (_url, options) => {
    assert.equal(options.signal.aborted, true);
    options.signal.throwIfAborted();
  });
  assert.equal((await POST(request(payload, controller.signal))).status, 408);
});

test("forwards incremental audio and propagates consumer cancellation", async () => {
  let source;
  let cancelled = false;
  const stream = new ReadableStream({ start(c) { source = c; }, cancel() { cancelled = true; } });
  fetchMock.mock.mockImplementation(async () => new Response(stream, { headers: { "Content-Type": "audio/mpeg" } }));
  // POST must return before the source produces any bytes or closes.
  const res = await POST(request());
  const reader = res.body.getReader();
  source.enqueue(new Uint8Array([1, 2]));
  assert.deepEqual((await reader.read()).value, new Uint8Array([1, 2]));
  source.enqueue(new Uint8Array([3, 4]));
  assert.deepEqual((await reader.read()).value, new Uint8Array([3, 4]));
  await reader.cancel();
  assert.equal(cancelled, true);
});
