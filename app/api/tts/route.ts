import { TtsRequestSchema, type TtsError } from "@/lib/tts";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BODY_BYTES = 32 * 1024;

function failure(reason: string, status: number, headers: Record<string, string> = {}) {
  return Response.json({ ok: false, reason } satisfies TtsError, {
    status, headers: { "Cache-Control": "no-store", ...headers },
  });
}

export async function POST(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return failure("Send an application/json request.", 415);
  }

  const reader = request.body?.getReader();
  if (!reader) return failure("Request body is required.", 400);
  let body: unknown;
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return failure("Request exceeds the 32 KB limit.", 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return failure("Request body must be valid JSON.", 400);
  } finally {
    reader.releaseLock();
  }

  const parsed = TtsRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return failure(`${issue?.path.join(".") || "request"}: ${issue?.message ?? "Invalid speech request."}`, 400);
  }
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) return failure("Speech is not configured. Set ELEVENLABS_API_KEY on the server.", 503);

  try {
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(parsed.data.voiceId)}/stream?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({
          text: parsed.data.text,
          model_id: process.env.ELEVENLABS_MODEL?.trim() || "eleven_multilingual_v2",
        }),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(45_000)]),
      },
    );

    if (!upstream.ok) {
      // Discard provider bodies rather than leaking credentials or account details.
      await upstream.body?.cancel();
      if (upstream.status === 401 || upstream.status === 403) {
        return failure("Speech provider authorization failed. Check the server's ElevenLabs key and permissions.", 503);
      }
      if (upstream.status === 429) {
        const retryAfter = upstream.headers.get("retry-after");
        const headers: Record<string, string> = retryAfter && /^\d{1,5}$/.test(retryAfter) ? { "Retry-After": retryAfter } : {};
        return failure("Speech is busy or the provider limit has been reached. Please try again later.", 429, headers);
      }
      if (upstream.status === 404) return failure("The selected voice is unavailable. Choose another voice.", 400);
      return failure("Speech generation failed. Please try again.", 502);
    }
    if (!upstream.body || upstream.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "audio/mpeg") {
      await upstream.body?.cancel();
      return failure("Speech provider returned an invalid audio response.", 502);
    }

    // Forward chunks without buffering the whole clip. Consumer cancellation
    // cancels this same upstream stream; request aborts also stop the fetch.
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (request.signal.aborted) return failure("Speech request was cancelled.", 408);
    if (error instanceof Error && error.name === "TimeoutError") {
      return failure("Speech generation timed out. Please try again.", 504);
    }
    return failure("Couldn't reach the speech provider. Please try again.", 502);
  }
}
