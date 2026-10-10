# Trying the voice interview

1. Choose a problem, language, voice, and tone on the setup page and start an interview.
2. Click **Start interview** in the interview room to hear the opening question.
3. Click **Click to talk**, allow the microphone when prompted, and speak. Click again to stop and submit. Recordings stop automatically after 60 seconds.
4. Your transcript and the interviewer's reply appear in the transcript panel. The selected ElevenLabs voice reads the reply aloud.
5. You can also use **Or type your answer**, **Send answer**, or **Can I get a hint?**. Every turn includes the current editor contents, problem, tone, language, and recent conversation.
6. **Stop audio** interrupts playback. Clicking the mic during playback interrupts and starts your next recording. **Cancel turn** cancels pending work. **I'm done** stops recording/playback and opens the existing review page.

If automatic playback is blocked, click **Play reply**. A failed Gemini request offers **Retry reply** without duplicating your transcript. Failed speech can be retried without generating another Gemini reply. Typed input also works when microphone access is unavailable.

Temporary Gemini failures now retry automatically up to twice with short increasing delays. Each attempt has a 15-second timeout; cancellation stops pending calls and retries. Authentication and invalid-request errors are not retried. Server diagnostics include only error category, numeric HTTP status, and attempt count, without prompts, credentials, or raw provider errors. Manual retry remains available if all attempts fail.

Rate limits (HTTP 429) wait about 3 seconds before the first retry and 6 seconds before the second, plus jitter, respecting longer provider retry hints when they fit within the request deadline. Other temporary failures use shorter delays. Daily quotas are not retried: the UI explains the quota and shows the provider's suggested wait when available. Automatic retries cannot remove provider quotas.

## API flow

`Microphone → POST /api/stt → candidate text → POST /api/interviewer → reply → POST /api/tts → browser audio`

- `/api/stt`: multipart form with an `audio` file; returns `{ ok, text }`. Uses the existing ElevenLabs Scribe integration.
- `/api/interviewer`: JSON with `transcript`, `problem`, `code`, `history`, `tone`, and `language`; returns `{ ok, reply }`.
- `/api/tts`: JSON with `text` and `voiceId`; returns MP3 audio.
- Typed answers and hints start at `/api/interviewer`.

The controller is in `lib/conversation.ts`; `lib/useInterview.ts` connects it to session storage; `lib/voice.ts` owns microphone recording; `components/InterviewRoom.tsx` connects the controls.

## Run locally

Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY` and `ELEVENLABS_API_KEY`. Configure `GEMINI_MODEL` for a model your account supports. This integration was verified with `gemini-3.5-flash`, `scribe_v2`, and `eleven_multilingual_v2`. Keep keys server-side and never commit `.env.local`.

```sh
npm ci
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

Open http://127.0.0.1:3000. Microphone recording requires localhost or HTTPS. The review/scoring implementation remains the repository's existing behavior; this change connects the live conversation.

## Verification

- Production build and TypeScript passed.
- 40 automated tests passed: interviewer, TTS, conversation sequencing, cancellation, automatic and manual retries, quota handling, and autoplay handling.
- Actual browser: opening question, typed follow-up, selected-voice playback, and stopping playback worked.
- Live HTTP: an existing generated MP3 was transcribed through `/api/stt`, its exact transcript went to `/api/interviewer`, and the exact reply went to `/api/tts`. All returned HTTP 200 with nonempty audio.
- Physical microphone capture and speaking into the device still need a user test; the live STT check used a generated audio file.

Run the automated checks on Node 24+:

```sh
node --experimental-test-module-mocks --test tests/interviewer.test.mjs tests/interviewer-retry.test.mjs tests/tts.test.mjs tests/conversation.test.mjs
```
