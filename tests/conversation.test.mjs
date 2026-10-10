import assert from "node:assert/strict";
import { test } from "node:test";
import { createConversation } from "../lib/conversation.ts";

function fixture(overrides = {}) {
  const session = { problem: { title: "Pair sum", statement: "Find a pair." }, code: "current code",
    config: { voiceId: "Rachel", tone: "Tough", language: "python" }, transcript: [{ role: "interviewer", text: "Ready?", at: 0 }] };
  const requests = [], states = [], players = [];
  const audio = () => new Response(new Blob(["audio"]), { headers: { "Content-Type": "audio/mpeg" } });
  const mockFetch = async (url, options) => {
    requests.push({ url, ...options, payload: JSON.parse(options.body) });
    if (overrides.fetch) return overrides.fetch(url, options, requests.length);
    return url === "/api/interviewer" ? Response.json({ ok: true, reply: "Use two pointers." }) : audio();
  };
  const conversation = createConversation({ getSession: () => session,
    append: (entry) => session.transcript.push({ ...entry, at: 1 }), onState: (state) => states.push(state),
    fetch: mockFetch, makeAudio: () => {
      const player = { onended: null, onerror: null, paused: false,
        play: async () => { if (overrides.play) await overrides.play(players.length); },
        pause() { this.paused = true; } };
      players.push(player); return player;
    },
  });
  return { conversation, session, requests, states, players, audio };
}

test("one turn sends current code/history/tone and speaks the exact Gemini reply", async () => {
  const f = fixture();
  assert.equal(await f.conversation.send(" How should I begin? "), true);
  assert.deepEqual(f.requests.map(r => r.url), ["/api/interviewer", "/api/tts"]);
  assert.deepEqual(f.requests[0].payload.history, [{ role: "interviewer", text: "Ready?", at: 0 }]);
  assert.equal(f.requests[0].payload.code, "current code");
  assert.equal(f.requests[0].payload.tone, "Tough");
  assert.equal(f.requests[0].payload.transcript, "How should I begin?");
  assert.deepEqual(f.requests[1].payload, { text: "Use two pointers.", voiceId: "Rachel" });
  assert.equal(f.session.transcript.length, 3);
  assert.equal(f.states.at(-1).phase, "speaking");
  f.players[0].onended();
  assert.equal(f.states.at(-1).phase, "idle");
  assert.equal(f.players[0].paused, true);
});

test("double submission is serialized and blank or ended interviews do not send", async () => {
  const f = fixture();
  const first = f.conversation.send("hello");
  assert.equal(await f.conversation.send("duplicate"), false);
  await first; f.conversation.stop();
  assert.equal(await f.conversation.send("  "), false);
  f.session.endedAt = 1;
  assert.equal(await f.conversation.send("ended"), false);
  assert.equal(f.requests.length, 2);
});

test("Gemini failure can retry without duplicating the candidate turn", async () => {
  const f = fixture({ fetch: async (url, _options, count) => {
    if (count === 1) return Response.json({ ok: false, reason: "Temporary Gemini failure" }, { status: 502 });
    return url === "/api/interviewer" ? Response.json({ ok: true, reply: "Try two pointers." }) : f.audio();
  } });
  assert.equal(await f.conversation.send("help"), false);
  assert.equal(f.states.at(-1).retry, "turn");
  await f.conversation.retry();
  assert.equal(f.session.transcript.filter(t => t.role === "candidate").length, 1);
  assert.equal(f.session.transcript.length, 3);
  f.conversation.dispose();
});

test("TTS retry preserves the text reply and does not call Gemini again", async () => {
  const f = fixture({ fetch: async (url, _options, count) => {
    if (url === "/api/interviewer") return Response.json({ ok: true, reply: "Try two pointers." });
    if (count === 2) return Response.json({ ok: false, reason: "Speech busy" }, { status: 429 });
    return f.audio();
  } });
  await f.conversation.send("help");
  assert.equal(f.states.at(-1).retry, "audio");
  await f.conversation.retry();
  assert.equal(f.requests.filter(r => r.url === "/api/interviewer").length, 1);
  assert.equal(f.session.transcript.length, 3);
  f.conversation.dispose();
});

test("autoplay blocking provides a play action using the cached audio", async () => {
  const f = fixture({ play: async (count) => { if (count === 1) throw new DOMException("blocked", "NotAllowedError"); } });
  await f.conversation.send("help");
  assert.equal(f.states.at(-1).retry, "audio");
  assert.match(f.states.at(-1).error, /Click Play reply/);
  await f.conversation.retry();
  assert.equal(f.requests.length, 2);
  assert.equal(f.states.at(-1).phase, "speaking");
  f.conversation.dispose();
});

test("late responses after cancellation do not append or speak", async () => {
  let resolve;
  const f = fixture({ fetch: () => new Promise(done => { resolve = done; }) });
  const run = f.conversation.send("hello");
  f.conversation.stop();
  assert.equal(f.requests[0].signal.aborted, true);
  resolve(Response.json({ ok: true, reply: "stale" }));
  await run;
  assert.equal(f.session.transcript.length, 2);
  assert.equal(f.players.length, 0);
  assert.equal(f.states.at(-1).phase, "idle");
});

test("interrupting playback releases it and allows the next turn with updated code", async () => {
  const f = fixture();
  await f.conversation.send("first");
  f.conversation.stop();
  assert.equal(f.players[0].paused, true);
  f.session.code = "updated code";
  await f.conversation.send("second");
  assert.equal(f.requests[2].payload.code, "updated code");
  assert.equal(f.requests[2].payload.history.length, 3);
  f.conversation.dispose();
});

test("dispose cancels pending audio without publishing further UI state", async () => {
  let resolve;
  const f = fixture({ fetch: async (url) => url === "/api/interviewer"
    ? Response.json({ ok: true, reply: "Hi" }) : new Promise(done => { resolve = done; }) });
  const run = f.conversation.send("first");
  while (!resolve) await new Promise(done => setImmediate(done));
  const stateCount = f.states.length;
  f.conversation.dispose();
  resolve(f.audio()); await run;
  assert.equal(f.players.length, 0);
  assert.equal(f.states.length, stateCount);
});
