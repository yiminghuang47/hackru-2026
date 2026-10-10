import { generateJson } from "@/lib/gemini";
import { RESULT_SYSTEM, resultPrompt } from "@/lib/result-prompts";
import {
  GeminiScorecardSchema,
  ResultRequestSchema,
  computeOverall,
  type ResultResponse,
} from "@/lib/scorecard";

export const maxDuration = 60;

function reply(body: ResultResponse, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Scores a finished interview from its transcript and final code. */ // this is the endpoint
export async function POST(request: Request) {
  const parsed = ResultRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join(".");
    return reply(
      { ok: false, reason: `${field ? `${field}: ` : ""}${issue?.message ?? "Invalid request."}` },
      400,
    );
  }

  try {
    const result = await generateJson({
      system: RESULT_SYSTEM,    
      prompt: resultPrompt(parsed.data),
      schema: GeminiScorecardSchema,
      // Low temperature so the same interview gets a similar score each time.
      temperature: 0.2,
    });

    // The overall number is computed here, not by the model, so it is consistent.
    const { overall, hintPenalty } = computeOverall(result.scores, parsed.data.hintsUsed);
    return reply({ ok: true, scorecard: { ...result, overall, hintPenalty } });
  } catch (err) {
    console.error("[result]", err);
    const message = err instanceof Error && err.message.includes("GEMINI_API_KEY")
      ? err.message
      : "Gemini couldn't score this interview. Try again.";
    return reply({ ok: false, reason: message }, 500);
  }
}
