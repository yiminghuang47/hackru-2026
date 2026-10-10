// Server-side only: reads ELEVENLABS_API_KEY. Import from route handlers, never from client components.

const API_BASE = "https://api.elevenlabs.io/v1";
export const STT_MODEL = process.env.ELEVENLABS_STT_MODEL ?? "scribe_v2";

function getApiKey() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set. Add it to .env.local.");
  return apiKey;
}

/**
 * Transcribes one recorded candidate turn with ElevenLabs Scribe.
 * Accepts whatever MediaRecorder produced (webm in Chrome, mp4 in Safari).
 */
export async function transcribe(audio: Blob, filename = "turn.webm"): Promise<string> {
  const body = new FormData();
  body.append("file", audio, filename);
  body.append("model_id", STT_MODEL);
  // Skip "(laughter)"-style tags; the transcript should only hold what the candidate said.
  body.append("tag_audio_events", "false");

  const res = await fetch(`${API_BASE}/speech-to-text`, {
    method: "POST",
    headers: { "xi-api-key": getApiKey() },
    body,
  });
  if (!res.ok) {
    throw new Error(`Scribe request failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}
