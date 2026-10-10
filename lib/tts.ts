import { z } from "zod";

export const TtsRequestSchema = z.object({
  text: z.string().trim().min(1, "Speech text cannot be empty.").max(2400),
  voiceId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,128}$/, "Provide a valid voice ID."),
});

export type TtsRequest = z.input<typeof TtsRequestSchema>;
export type TtsError = { ok: false; reason: string };
