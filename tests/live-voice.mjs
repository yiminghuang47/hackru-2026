// Explicit paid smoke test on Node 24+: node tests/live-voice.mjs voice-test.mp3
// Calls the real route handlers and both providers. Does not test frontend playback or Next.js hosting.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = new URL("../", import.meta.url);
const env = new URL(".env.local", root);
if (existsSync(env)) process.loadEnvFile(fileURLToPath(env));
registerHooks({ resolve(specifier, context, nextResolve) {
  let url;
  if (specifier.startsWith("@/")) url = new URL(specifier.slice(2), root);
  else if (specifier.startsWith(".") && context.parentURL?.startsWith(root.href)) url = new URL(specifier, context.parentURL);
  if (url && existsSync(fileURLToPath(url.href + ".ts"))) return nextResolve(url.href + ".ts", context);
  return nextResolve(specifier, context);
} });

const output = resolve(process.argv[2] || "voice-test.mp3");
const deadline = setTimeout(() => { console.error("Voice test timed out after 90 seconds."); process.exit(1); }, 90_000);
try {
  const { POST: interviewer } = await import(new URL("app/api/interviewer/route.ts", root).href);
  const { POST: tts } = await import(new URL("app/api/tts/route.ts", root).href);
  const makeRequest = (path, body) => new Request(`http://localhost${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const start = performance.now();
  const interviewResponse = await interviewer(makeRequest("/api/interviewer", {
    transcript: "Can I assume the array is sorted?",
    problem: { title: "Pair Sum", statement: "Given a sorted integer array, return two indices whose values sum to target." },
    code: "", history: [], tone: "Friendly", language: "python",
  }));
  const interview = await interviewResponse.json();
  if (!interviewResponse.ok || !interview.ok || !interview.reply?.trim()) {
    throw new Error(`Interviewer failed (${interviewResponse.status}): ${interview.reason || "Missing reply"}`);
  }
  const interviewerMs = Math.round(performance.now() - start);
  const voiceId = "21m00Tcm4TlvDq8ikWAM";
  // Feed the exact Gemini output into TTS, without a canned replacement.
  const speechResponse = await tts(makeRequest("/api/tts", { text: interview.reply, voiceId }));
  if (!speechResponse.ok) {
    const error = await speechResponse.json();
    throw new Error(`TTS failed (${speechResponse.status}): ${error.reason}`);
  }
  if (speechResponse.headers.get("content-type") !== "audio/mpeg") throw new Error("Expected MP3 audio.");
  const chunks = [];
  let firstAudioMs;
  for await (const chunk of speechResponse.body) {
    firstAudioMs ??= Math.round(performance.now() - start);
    chunks.push(Buffer.from(chunk));
  }
  const audio = Buffer.concat(chunks);
  if (audio.length < 100) throw new Error("Audio was empty or truncated.");
  await writeFile(output, audio);
  const sourceHashes = {};
  for (const path of ["app/api/interviewer/route.ts", "app/api/tts/route.ts", "lib/interviewer.ts", "lib/interviewer-prompts.ts", "lib/tts.ts", "lib/gemini.ts", "lib/types.ts"]) {
    const content = await readFile(new URL(path, root));
    sourceHashes[path] = createHash("sha1").update(`blob ${content.length}\0`).update(content).digest("hex");
  }
  const report = {
    testedAt: new Date().toISOString(), scope: "Real route handlers with live Gemini and ElevenLabs; no frontend or Next.js server test",
    interviewerStatus: interviewResponse.status, ttsStatus: speechResponse.status,
    reply: interview.reply, voiceId, geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    ttsModel: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
    interviewerMs, firstAudioMs, totalMs: Math.round(performance.now() - start),
    audioBytes: audio.length, audioChunks: chunks.length, output, sourceHashes,
  };
  await writeFile(output + ".json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  let message = String(error?.message || error);
  for (const key of [process.env.GEMINI_API_KEY, process.env.ELEVENLABS_API_KEY]) {
    if (key) message = message.split(key).join("[REDACTED]");
  }
  console.error(message);
  process.exitCode = 1;
} finally {
  clearTimeout(deadline);
}
