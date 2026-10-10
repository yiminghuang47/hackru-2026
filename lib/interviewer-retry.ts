import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";

// Log only categories and numeric HTTP status, never provider messages or inputs.
export function interviewerFailure(error: unknown): {
  category: string; status?: number; retryable: boolean; retryAfterSeconds?: number;
} {
  const status = error && typeof error === "object" && "status" in error
    && typeof error.status === "number" ? error.status : undefined;
  if (status === 429 && error instanceof Error) {
    let retryAfterSeconds: number | undefined;
    try {
      const details = JSON.parse(error.message)?.error?.details;
      const hint = Array.isArray(details) ? details.find((item) => item?.["@type"] === "type.googleapis.com/google.rpc.RetryInfo")?.retryDelay : undefined;
      if (typeof hint === "string" && /^\d+(\.\d+)?s$/.test(hint)) retryAfterSeconds = Math.ceil(parseFloat(hint));
    } catch { /* Provider errors do not always contain JSON. */ }
    const daily = /per.?day|daily/i.test(error.message);
    return { category: daily ? "daily_quota" : "rate_limit", status, retryable: !daily, retryAfterSeconds };
  }
  if (status !== undefined) return {
    category: "provider", status, retryable: [408, 429, 500, 502, 503, 504].includes(status),
  };
  if (error instanceof SyntaxError || error instanceof z.ZodError) {
    return { category: "invalid_reply", retryable: true };
  }
  if (error instanceof Error && error.name === "TimeoutError") {
    return { category: "timeout", retryable: true };
  }
  if (error instanceof TypeError && /fetch failed|network|failed to fetch/i.test(error.message)) {
    return { category: "network", retryable: true };
  }
  return { category: "unknown", retryable: false };
}

/** At most three attempts, each bounded to 15s; stays below the route's 60s limit. */
export async function withInterviewerRetry<T>(
  generate: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
  { attemptTimeoutMs = 15_000, delayMs = 500, rateLimitDelayMs = 3_000 } = {},
): Promise<T> {
  const startedAt = Date.now();
  for (let attempt = 1; ; attempt++) {
    signal.throwIfAborted();
    const deadline = AbortSignal.timeout(attemptTimeoutMs);
    const attemptSignal = AbortSignal.any([signal, deadline]);
    try {
      const result = await generate(attemptSignal);
      attemptSignal.throwIfAborted();
      return result;
    } catch (error) {
      // Cancelling a turn must not start another provider request.
      signal.throwIfAborted();
      const failure = interviewerFailure(deadline.aborted ? deadline.reason : error);
      const baseDelay = failure.status === 429 ? rateLimitDelayMs : delayMs;
      const waitMs = Math.max((failure.retryAfterSeconds ?? 0) * 1000,
        baseDelay * 2 ** (attempt - 1) + Math.floor(Math.random() * baseDelay / 2));
      // Respect provider retry hints without exceeding the hosting deadline.
      const willRetry = failure.retryable && attempt < 3 && Date.now() - startedAt + waitMs + attemptTimeoutMs < 55_000;
      console.warn("[interviewer] generation failed", { ...failure, attempt, willRetry });
      if (!willRetry) throw error;
      await delay(waitMs, undefined, { signal });
    }
  }
}
