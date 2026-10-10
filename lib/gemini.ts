// Server-side only: reads GEMINI_API_KEY. Import from route handlers, never from client components.
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

let client: GoogleGenAI | undefined;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set. Add it to .env.local.");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

/**
 * Calls Gemini in JSON mode with a schema derived from `schema`, then validates
 * the reply with the same zod schema so callers get a typed, trusted value.
 */
export async function generateJson<T extends z.ZodType>({
  system,
  prompt,
  schema,
  temperature = 0.4,
  signal,
}: {
  system: string;
  prompt: string;
  schema: T;
  temperature?: number;
  signal?: AbortSignal;
}): Promise<z.infer<T>> {
  // Gemini rejects the "$schema" keyword, so drop it from zod's output.
  const jsonSchema: Record<string, unknown> = z.toJSONSchema(schema, { target: "draft-2020-12" });
  delete jsonSchema.$schema;

  const res = await getClient().models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      responseJsonSchema: jsonSchema,
      temperature,
      abortSignal: signal,
    },
  });

  const text = res.text;
  if (!text) throw new SyntaxError("Gemini returned an empty response.");
  return schema.parse(JSON.parse(text));
}
