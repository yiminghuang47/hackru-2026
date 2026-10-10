import { z } from "zod";

export const TOPICS = [
  "Two Pointers",
  "Sliding Window",
  "Dynamic Programming",
  "Graphs",
  "Binary Search",
  "Trees",
  "Heap",
  "Backtracking",
] as const;

export const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
export const MAX_QUESTION_CHARS = 8000;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const LANGUAGES = ["python", "javascript", "java", "cpp"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  python: "Python",
  javascript: "JavaScript",
  java: "Java",
  cpp: "C++",
};

export const TONES = ["Friendly", "Neutral", "Tough"] as const;
export type Tone = (typeof TONES)[number];

// Everything about a problem except its identity. This is also the shape Gemini
// fills in when formatting a custom question.
export const ProblemContentSchema = z.object({
  title: z.string(),
  topic: z.string(),
  difficulty: z.enum(DIFFICULTIES),
  statement: z.string(),
  examples: z.array(
    z.object({
      input: z.string(),
      output: z.string(),
      explanation: z.string().optional(),
    }),
  ),
  constraints: z.array(z.string()),
  // Explicit keys (not z.record) so the JSON schema sent to Gemini stays simple.
  starterCode: z.object({
    python: z.string(),
    javascript: z.string(),
    java: z.string(),
    cpp: z.string(),
  }),
  edgeCases: z.array(z.string()),
  optimalComplexity: z.object({ time: z.string(), space: z.string() }),
  keyInsights: z.array(z.string()),
  referenceSolution: z.string(),
  hintLadder: z.array(z.string()),
});
export type ProblemContent = z.infer<typeof ProblemContentSchema>;

export const ProblemSchema = ProblemContentSchema.extend({
  id: z.string(),
  source: z.enum(["bank", "custom"]).default("bank"),
});
export type Problem = z.infer<typeof ProblemSchema>;

export type ParseQuestionResponse =
  | { ok: true; problem: Problem }
  | { ok: false; reason: string };

/** `/api/stt`: one recorded candidate turn → text. Empty `text` means no speech was found. */
export type SttResponse =
  | { ok: true; text: string }
  | { ok: false; reason: string };

export type SessionConfig = {
  topic: string; // one of TOPICS or a custom "Other" topic
  difficulty: Difficulty;
  language: Language;
  voiceId: string;
  tone: Tone;
};

export type TranscriptEntry = {
  role: "interviewer" | "candidate";
  text: string;
  at: number; // ms since session start
};

export type Session = {
  id: string;
  config: SessionConfig;
  problem: Problem;
  code: string;
  transcript: TranscriptEntry[];
  hintsUsed: number;
  startedAt: number;
  endedAt?: number;
};
