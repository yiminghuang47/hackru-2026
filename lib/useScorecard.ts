"use client";

import { useEffect, useState } from "react";
import { useSessionStore } from "./session";
import type { ResultRequest, ResultResponse } from "./scorecard";
import type { Session } from "./types";

// One request per session at a time, even if the effect runs twice (React strict mode).
const inFlight = new Map<string, Promise<ResultResponse>>();

function requestScorecard(session: Session): Promise<ResultResponse> {
  let pending = inFlight.get(session.id);
  if (!pending) {
    const body: ResultRequest = {
      problem: session.problem,
      language: session.config.language,
      tone: session.config.tone,
      code: session.code,
      transcript: session.transcript,
      hintsUsed: session.hintsUsed,
      durationMs: (session.endedAt ?? Date.now()) - session.startedAt,
    };
    pending = fetch("/api/result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => res.json() as Promise<ResultResponse>)
      .catch((): ResultResponse => ({ ok: false, reason: "Couldn't reach the scoring service." }))
      .finally(() => inFlight.delete(session.id));
    inFlight.set(session.id, pending);
  }
  return pending;
}

/**
 * Scores a finished session once and saves the result on it, so reloading the
 * review page doesn't score it again. Returns the error (if any) and a retry.
 */
export function useScorecard(session: Session | undefined) {
  const setScorecard = useSessionStore((s) => s.setScorecard);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const needsScore = !!session?.endedAt && !session.scorecard;

  useEffect(() => {
    if (!session || !needsScore) return;
    let cancelled = false;
    requestScorecard(session).then((res) => {
      if (cancelled) return;
      if (res.ok) setScorecard(session.id, res.scorecard);
      else setError(res.reason);
    });
    return () => {
      cancelled = true;
    };
    // `attempt` re-runs this after a failed try.
  }, [session, needsScore, attempt, setScorecard]);

  return {
    error,
    retry: () => {
      setError(null);
      setAttempt((n) => n + 1);
    },
  };
}
