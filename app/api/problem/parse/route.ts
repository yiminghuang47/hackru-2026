import { z } from "zod";
import { generateJson } from "@/lib/gemini";
import { FORMAT_QUESTION_SYSTEM, formatQuestionPrompt } from "@/lib/prompts";
import {
  DIFFICULTIES,
  MAX_QUESTION_CHARS,
  ProblemContentSchema,
  type ParseQuestionResponse,
  type Problem,
} from "@/lib/types";

const RequestSchema = z.object({
  text: z.string().trim().min(20, "Add a bit more detail to the question.").max(MAX_QUESTION_CHARS),
  title: z.string().trim().max(120).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  topic: z.string().trim().max(60).optional(),
});

const GeminiReplySchema = z.object({
  ok: z.boolean(),
  reason: z.string(),
  problem: ProblemContentSchema.optional(),
});

function reply(body: ParseQuestionResponse, status = 200) {
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return reply({ ok: false, reason: parsed.error.issues[0]?.message ?? "Invalid request." }, 400);
  }

  try {
    const result = await generateJson({
      system: FORMAT_QUESTION_SYSTEM,
      prompt: formatQuestionPrompt(parsed.data),
      schema: GeminiReplySchema,
    });

    if (!result.ok || !result.problem) {
      return reply({ ok: false, reason: result.reason || "That doesn't look like a coding question." });
    }

    const problem: Problem = {
      ...result.problem,
      id: `custom-${crypto.randomUUID()}`,
      source: "custom",
    };
    return reply({ ok: true, problem });
  } catch (err) {
    console.error("[problem/parse]", err);
    const message = err instanceof Error && err.message.includes("GEMINI_API_KEY")
      ? err.message
      : "Gemini couldn't format that question. Try again.";
    return reply({ ok: false, reason: message }, 500);
  }
}
