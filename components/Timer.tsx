"use client";

import { useEffect, useState } from "react";

const INTERVIEW_LENGTH_MS = 45 * 60 * 1000;

function format(ms: number) {
  const total = Math.floor(Math.abs(ms) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${ms < 0 ? "-" : ""}${m}:${s.toString().padStart(2, "0")}`;
}

/** Counts down from 45 minutes; goes negative (in red) once time is up. */
export function Timer({ startedAt, endedAt }: { startedAt: number; endedAt?: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [endedAt]);

  const remaining = INTERVIEW_LENGTH_MS - ((endedAt ?? now) - startedAt);
  const color = remaining < 0 ? "text-rose-400" : remaining < 5 * 60 * 1000 ? "text-amber-400" : "text-zinc-200";

  return <span className={`font-mono text-sm tabular-nums ${color}`}>{format(remaining)}</span>;
}
