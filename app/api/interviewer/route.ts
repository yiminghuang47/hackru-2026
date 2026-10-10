import { generateJson } from "@/lib/gemini";
import {
  InterviewerReplySchema,
  InterviewerRequestSchema,
  type InterviewerResponse,
} from "@/lib/interviewer";
import { interviewerPrompt, interviewerSystemPrompt } from "@/lib/interviewer-prompts";
import { interviewerFailure, withInterviewerRetry } from "@/lib/interviewer-retry";

export const maxDuration = 60;

const MAX_BODY_BYTES = 256 * 1024;

function respond(body: InterviewerResponse, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return respond({ ok: false, reason: "Send an application/json request." }, 415);
  }

  // Limit bytes as they arrive, including requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return respond({ ok: false, reason: "Request body is required." }, 400);

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
        return respond({ ok: false, reason: "Request exceeds the 256 KB limit. Shorten the history or code." }, 413);
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
    return respond({ ok: false, reason: "Request body must be valid JSON." }, 400);
  } finally {
    reader.releaseLock();
  }

  const parsed = InterviewerRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join(".");
    return respond({
      ok: false,
      reason: `${field ? `${field}: ` : ""}${issue?.message ?? "Invalid interview request."}`,
    }, 400);
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    return respond({ ok: false, reason: "Interviewer is not configured. Set GEMINI_API_KEY on the server." }, 503);
  }

  try {
    const result = await withInterviewerRetry((signal) => generateJson({
      system: interviewerSystemPrompt(parsed.data.tone),
      prompt: interviewerPrompt(parsed.data),
      schema: InterviewerReplySchema,
      temperature: 0.4,
      signal,
    }), request.signal);
    return respond({ ok: true, reply: result.reply });
  } catch (error) {
    // Do not expose provider errors, credentials, or candidate code/transcripts.
    if (request.signal.aborted) return respond({ ok: false, reason: "Interview turn cancelled." }, 499);
    const failure = interviewerFailure(error);
    if (failure.category === "daily_quota") {
      const wait = failure.retryAfterSeconds ? ` Try again in about ${Math.ceil(failure.retryAfterSeconds / 60)} minutes.` : " Try again after the quota resets.";
      return respond({ ok: false, reason: `Gemini's daily request limit has been reached.${wait}` }, 503);
    }
    if (failure.status === 429) {
      return respond({ ok: false, reason: "The interviewer is receiving too many requests. Wait a moment, then try again." }, 503);
    }
    return respond({ ok: false, reason: "The interviewer couldn't respond. Please try again." }, 502);
  }
}
