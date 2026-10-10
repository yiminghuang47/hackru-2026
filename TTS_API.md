# Text to speech

`POST /api/tts` accepts JSON `{ text, voiceId }` and proxies ElevenLabs' streaming text-to-speech API. Success is an MP3 audio stream (`audio/mpeg`), not JSON. Use the same route for interviewer replies and voice previews.

## Configuration

Set `ELEVENLABS_API_KEY` in the server's `.env.local`, or your deployment environment. Never put it in client code or a `NEXT_PUBLIC_` variable. Restart the development server after changing environment variables. The optional `ELEVENLABS_MODEL` defaults to `eleven_multilingual_v2`.

No additional npm package is needed. The route uses native fetch and the project's existing Zod dependency.

## Request and response

```json
{
  "text": "Walk me through your approach.",
  "voiceId": "JBFqnCBsd6RMkjVDRZzb"
}
```

Both fields are required. Text is trimmed and must contain 1–2,400 characters, matching the interviewer reply limit. Use an ElevenLabs voice ID available to your account, such as the selected `session.config.voiceId`. Request bodies are limited to 32 KiB, including streamed bodies without Content-Length.

Errors before streaming starts return JSON `{ "ok": false, "reason": "..." }`: 400 invalid input/unavailable voice, 413 body too large, 415 wrong content type, 429 provider capacity/quota limit, 503 missing key/provider authorization failure, 504 timeout, 502 other provider failure. A cancelled request returns 408 if the client is still connected. Provider error bodies and credentials are not returned or logged. There are no automatic paid-request retries.

Audio is forwarded as chunks arrive, with a 45-second provider timeout. If an upstream error or timeout happens after audio headers were sent, the stream fails; it cannot become a JSON error at that point. Clients must handle failures while consuming audio too.

## Frontend usage

After `/api/interviewer` returns `{ ok: true, reply }`, pass `reply` and the selected voice to this helper:

```ts
async function speak(text: string, voiceId: string) {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voiceId }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.reason ?? "Speech failed.");
  }
  const url = URL.createObjectURL(await response.blob());
  const audio = new Audio(url);
  const cleanup = () => URL.revokeObjectURL(url);
  audio.addEventListener("ended", cleanup, { once: true });
  audio.addEventListener("error", cleanup, { once: true });
  try {
    await audio.play();
  } catch (error) {
    cleanup();
    throw error; // Surface a Play button if browser autoplay is blocked.
  }
  return () => { audio.pause(); cleanup(); }; // Call on stop/unmount.
}
```

This simple example buffers the clip with `blob()` before playback, even though the server streams it. Playback during download needs a frontend streaming player. Call from a user-initiated flow and handle autoplay restrictions. Microphone recording, STT, and button wiring are separate from this endpoint.

## Verification

Node 24+: `node --test tests/tts.test.mjs` (mocked provider, no paid API calls).

To explicitly test the real Gemini → ElevenLabs chain (uses provider credits), install dependencies, set both server API keys and an available `GEMINI_MODEL` in `.env.local`, then run:

```sh
node tests/live-voice.mjs voice-test.mp3
```

This calls both actual route handlers, forwards Gemini's exact reply to TTS, and saves the MP3 plus a JSON report. It does not test Next.js hosting or frontend wiring. The earlier live Gemini test used `GEMINI_MODEL=gemini-3.5-flash`; availability depends on your account.

With `npm run dev` running:

```sh
curl --fail-with-body http://localhost:3000/api/tts \
  -H 'Content-Type: application/json' \
  -d '{"text":"Walk me through your approach.","voiceId":"JBFqnCBsd6RMkjVDRZzb"}' \
  --output speech.mp3
```

On a non-200 response, inspect the JSON error instead of playing the output as audio. The route does not add user authentication or per-user rate limiting to the existing app.

References: [ElevenLabs streaming API](https://elevenlabs.io/docs/api-reference/text-to-speech/stream), [Next.js route handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route).
