# Interviewer endpoint

`POST /api/interviewer` receives the text produced by your STT endpoint and returns a Gemini interviewer response. It uses the existing `lib/gemini.ts` helper and `GEMINI_MODEL` setting. It does not record, transcribe, execute candidate code, or call ElevenLabs.

Set `GEMINI_API_KEY` in the server's `.env.local` (the repository already documents this key in `.env.example`). Never use a `NEXT_PUBLIC_` key for it.

## Frontend integration

Call this after STT returns a nonempty transcript. `session` is your existing Zustand session. Capture history before adding the new candidate entry so the current utterance is sent only once. For long sessions, send only the most recent 40 entries.

```ts
import type { InterviewerRequest, InterviewerResponse } from "@/lib/interviewer";

const history = session.transcript.slice(-40);
addTranscript(session.id, { role: "candidate", text: candidateText });

const payload: InterviewerRequest = {
  transcript: candidateText,
  problem: session.problem,
  code: session.code,
  history,
  tone: session.config.tone,
  language: session.config.language,
};

const response = await fetch("/api/interviewer", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
const result: InterviewerResponse = await response.json();
if (!result.ok) throw new Error(result.reason);
if (!response.ok) throw new Error("The interviewer request failed.");

addTranscript(session.id, { role: "interviewer", text: result.reply });
// Next: send result.reply and session.config.voiceId to your /api/tts endpoint.
```

Keep the talk button in its processing state until this turn finishes. Display failures and allow retrying the same transcript without appending it again. STT, TTS, and button wiring remain separate integration work.

## Contract

Required JSON fields: `transcript` (nonempty, up to 8,000 characters), `problem` (at least `title` and `statement`), `code` (may be empty, up to 60,000 characters), and `tone` (`Friendly`, `Neutral`, or `Tough`).

Optional fields: `history` (chronological `{ role: "candidate" | "interviewer", text, at? }` entries; defaults to `[]`) and `language` (`python`, `javascript`, `java`, or `cpp`). The optional history `at` value is milliseconds since the interview started, matching the existing session type. Only the latest 40 history entries are included in the model prompt.

The problem may include `topic`, `difficulty`, `examples`, and `constraints`. Passing a full `session.problem` is supported; private/reference fields are stripped from the prompt. This endpoint is for a candidate-requested turn, so it always returns a reply rather than using unsolicited-interjection `speak:false` logic.

Success (200):

```json
{ "ok": true, "reply": "Yes, the array is sorted in ascending order." }
```

Failure: `{ "ok": false, "reason": "A user-facing explanation." }`.

| Status | Meaning |
| --- | --- |
| 400 | Malformed JSON or invalid request fields |
| 413 | Request body exceeds 256 KiB |
| 415 | Content-Type is not application/json |
| 503 | Server has no GEMINI_API_KEY |
| 502 | Gemini request failed or its output failed validation |

## Smoke test

With dependencies installed and `npm run dev` running:

```sh
curl http://localhost:3000/api/interviewer \
  -H 'Content-Type: application/json' \
  -d '{"transcript":"Can I assume the array is sorted?","problem":{"title":"Pair Sum","statement":"Given a sorted integer array, return two indices whose values sum to target."},"code":"","history":[],"tone":"Friendly","language":"python"}'
```

## Automated tests

On Node 24 or newer, after installing project dependencies:

```sh
node --experimental-test-module-mocks --test tests/interviewer.test.mjs
```

Tests mock the Gemini helper; they exercise the actual route handler, Zod validation, prompt construction, history handling, body limits, and errors without a paid provider call. They do not establish model response quality or network availability.

Implementation references: [Next.js route handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route), [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output).
