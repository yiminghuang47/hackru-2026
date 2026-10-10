"use client";

import { useEffect, useRef } from "react";
import type { TranscriptEntry } from "@/lib/types";

export function TranscriptPanel({ transcript }: { transcript: TranscriptEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript.length]);

  if (transcript.length === 0) {
    return (
      <p className="p-4 text-sm text-zinc-500">
        The conversation will show up here once the interviewer starts talking.
      </p>
    );
  }

  return (
    <div className="space-y-3 p-4 text-sm">
      {transcript.map((t, i) => (
        <div key={i}>
          <p className={`text-xs font-semibold ${t.role === "interviewer" ? "text-emerald-400" : "text-sky-400"}`}>
            {t.role === "interviewer" ? "Interviewer" : "You"}
          </p>
          <p className="text-zinc-200">{t.text}</p>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
