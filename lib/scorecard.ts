import { z } from "zod";
import { LANGUAGES, ProblemSchema, TONES } from "./types";

export const SCORE_KEYS = [
  "problemSolving",
  "communication",
  "codeQuality",
  "correctness",
  "complexity",
] as const;
export type ScoreKey = (typeof SCORE_KEYS)[number];

export const SCORE_LABELS: Record<ScoreKey, string> = {
  problemSolving: "Problem solving",
  communication: "Communication",
  codeQuality: "Code quality",
  correctness: "Correctness",
  complexity: "Complexity analysis",
};

export const VERDICTS = ["Hire", "Lean Hire", "Lean No Hire", "No Hire"] as const;
export type Verdict = (typeof VERDICTS)[number];

const score = z.number().int().min(0).max(5);

/** What Gemini fills in. `overall` is added by the server afterwards. */
export const GeminiScorecardSchema = z.object({
  scores: z.object({
    problemSolving: score,
    communication: score,
    codeQuality: score,
    correctness: score,
    complexity: score,
  }),
  verdict: z.enum(VERDICTS),
  summary: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  keyMoments: z.array(z.object({ atMs: z.number(), note: z.string() })),
  bugs: z.array(z.string()),
  optimalSolution: z.string(),
  explanation: z.string(),
});

export const ScorecardSchema = GeminiScorecardSchema.extend({
  /** 0-100, computed from the five scores minus the hint penalty. */
  overall: z.number().int().min(0).max(100),
  hintPenalty: z.number().int().min(0),
});
export type Scorecard = z.infer<typeof ScorecardSchema>;

/** `POST /api/result` body: the finished session, minus what scoring doesn't need. */
export const ResultRequestSchema = z.object({
  problem: ProblemSchema,
  language: z.enum(LANGUAGES),
  tone: z.enum(TONES),
  code: z.string().max(50_000),
  transcript: z
    .array(
      z.object({
        role: z.enum(["interviewer", "candidate"]),
        text: z.string().max(8_000),
        at: z.number().nonnegative(),
      }),
    )
    .max(1_000),
  hintsUsed: z.number().int().nonnegative(),
  durationMs: z.number().nonnegative(),
});
export type ResultRequest = z.infer<typeof ResultRequestSchema>;

export type ResultResponse =
  | { ok: true; scorecard: Scorecard }
  | { ok: false; reason: string };

// How much each area counts toward the overall score. Sums to 1.
const WEIGHTS: Record<ScoreKey, number> = {
  correctness: 0.3,
  problemSolving: 0.25,
  communication: 0.2,
  codeQuality: 0.15,
  complexity: 0.1,
};
const POINTS_PER_HINT = 3;

/** Weighted 0-5 scores scaled to 0-100, then a few points off per hint used. */
export function computeOverall(scores: Record<ScoreKey, number>, hintsUsed: number) {
  const weighted = SCORE_KEYS.reduce((sum, key) => sum + scores[key] * WEIGHTS[key], 0);
  const hintPenalty = hintsUsed * POINTS_PER_HINT;
  const overall = Math.max(0, Math.min(100, Math.round((weighted / 5) * 100) - hintPenalty));
  return { overall, hintPenalty };
}
