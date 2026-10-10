"use client";

import { use } from "react";
import Link from "next/link";
import { useSessionStore, useStoreHydrated } from "@/lib/session";
import { LANGUAGE_LABELS } from "@/lib/types";
import { useScorecard } from "@/lib/useScorecard";
import { ScorecardView } from "@/components/ScorecardView";
import { TranscriptPanel } from "@/components/TranscriptPanel";

function formatDuration(ms: number) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

/** The page after "I'm done": the Gemini scorecard, then the final code and transcript. */
export function ReviewView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const hydrated = useStoreHydrated();
  const session = useSessionStore((s) => s.sessions[id]);
  const { error, retry } = useScorecard(session);

  if (!hydrated) return null;

  if (!session) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-zinc-400">This interview doesn&apos;t exist on this device.</p>
        <Link href="/" className="text-emerald-400 hover:underline">
          Start a new interview
        </Link>
      </main>
    );
  }

  const { problem, config, scorecard } = session;
  const duration = session.endedAt ? formatDuration(session.endedAt - session.startedAt) : "In progress";

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-zinc-500">Interview review</p>
          <h1 className="text-2xl font-semibold">{problem.title}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {problem.difficulty} · {problem.topic} · {LANGUAGE_LABELS[config.language]} · {config.tone} interviewer
          </p>
        </div>
        <Link href="/" className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400">
          New interview
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Time" value={duration} />
        <Stat label="Hints used" value={`${session.hintsUsed} / ${problem.hintLadder.length}`} />
        <Stat label="Score" value={scorecard ? `${scorecard.overall} / 100` : "—"} />
      </div>

      {scorecard ? (
        <ScorecardView scorecard={scorecard} />
      ) : !session.endedAt ? (
        <Notice>
          This interview is still in progress.{" "}
          <Link href={`/interview/${id}`} className="text-emerald-400 hover:underline">
            Go back to it
          </Link>{" "}
          and press &quot;I&apos;m done&quot; to get your score.
        </Notice>
      ) : error ? (
        <Notice>
          <span className="text-rose-400">{error}</span>{" "}
          <button type="button" onClick={retry} className="text-emerald-400 hover:underline">
            Try again
          </button>
        </Notice>
      ) : (
        <Notice>
          <span className="animate-pulse">Scoring your interview…</span> This reads your transcript
          and final code, and usually takes a few seconds.
        </Notice>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-300">Your final code</h2>
        <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 font-mono text-xs leading-relaxed">
          {session.code}
        </pre>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-300">Transcript</h2>
        <div className="rounded-lg border border-zinc-800">
          <TranscriptPanel transcript={session.transcript} />
        </div>
      </section>
    </main>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-zinc-800 p-6 text-sm text-zinc-300" role="status">
      {children}
    </p>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
