import { z } from "zod";
import { DIFFICULTIES, LANGUAGES, TONES } from "./types";

// Accept the public fields of a Problem. Zod strips extra fields, including
// referenceSolution and hintLadder, when callers pass a full session.problem.
const InterviewProblemSchema = z.object({
  title: z.string().trim().min(1).max(200),
  statement: z.string().trim().min(1).max(16000),
  topic: z.string().trim().max(100).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  examples: z.array(z.object({
    input: z.string().max(4000),
    output: z.string().max(4000),
    explanation: z.string().max(4000).optional(),
  })).max(10).default([]),
  constraints: z.array(z.string().max(1000)).max(30).default([]),
});

export const InterviewerRequestSchema = z.object({
  // Only the new utterance; history contains earlier turns in chronological order.
  transcript: z.string().trim().min(1, "Candidate transcript cannot be empty.").max(8000),
  problem: InterviewProblemSchema,
  code: z.string().max(60000),
  history: z.array(z.object({
    role: z.enum(["candidate", "interviewer"]),
    text: z.string().trim().min(1).max(8000),
    at: z.number().finite().nonnegative().optional(),
  })).max(100).default([]),
  tone: z.enum(TONES),
  language: z.enum(LANGUAGES).optional(),
});

export const InterviewerReplySchema = z.object({
  reply: z.string().trim().min(1).max(2400),
});

export type InterviewerRequest = z.input<typeof InterviewerRequestSchema>;
export type InterviewerContext = z.infer<typeof InterviewerRequestSchema>;
export type InterviewerResponse =
  | { ok: true; reply: string }
  | { ok: false; reason: string };
