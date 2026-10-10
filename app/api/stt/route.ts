import { transcribe } from "@/lib/elevenlabs";
import type { SttResponse } from "@/lib/types";

// Scribe's upload limit is far above this; a single spoken turn is well under 1 MB.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

function reply(body: SttResponse, status = 200) {
  return Response.json(body, { status });
}

/** POST multipart/form-data with an `audio` blob from MediaRecorder → `{ ok, text }`. */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return reply({ ok: false, reason: "Send the recording as an `audio` form field." }, 400);
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return reply({ ok: false, reason: "That recording is too long." }, 413);
  }

  try {
    const filename = audio instanceof File && audio.name ? audio.name : "turn.webm";
    const text = await transcribe(audio, filename);
    return reply({ ok: true, text });
  } catch (err) {
    console.error("[stt]", err);
    const message = err instanceof Error && err.message.includes("ELEVENLABS_API_KEY")
      ? err.message
      : "Couldn't transcribe that. Try again.";
    return reply({ ok: false, reason: message }, 500);
  }
}
