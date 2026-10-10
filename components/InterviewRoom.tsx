"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSessionStore, useStoreHydrated } from "@/lib/session";
import { LANGUAGE_LABELS } from "@/lib/types";
import { ProblemPanel } from "@/components/ProblemPanel";
import { CodeEditor } from "@/components/CodeEditor";
import { Timer } from "@/components/Timer";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { MicButton } from "@/components/MicButton";

export function InterviewRoom({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const hydrated = useStoreHydrated();
  const session = useSessionStore((s) => s.sessions[id]);
  const updateCode = useSessionStore((s) => s.updateCode);
  const addTranscript = useSessionStore((s) => s.addTranscript);
  const recordHint = useSessionStore((s) => s.recordHint);
  const endSession = useSessionStore((s) => s.endSession);

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

  const { problem, config } = session;
  const hintsLeft = problem.hintLadder.length - session.hintsUsed;

  // Placeholder: reads the problem's static hint ladder. Gemini takes over in milestone 2.
  function requestHint() {
    if (hintsLeft <= 0) return;
    addTranscript(id, { role: "candidate", text: "Can I get a hint?" });
    addTranscript(id, { role: "interviewer", text: problem.hintLadder[session.hintsUsed] });
    recordHint(id);
  }

  function finish() {
    endSession(id);
    router.push(`/review/${id}`);
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-zinc-800 px-4 py-2">
        <div className="flex min-w-0 items-center gap-3 text-sm">
          <Link href="/" className="font-semibold text-zinc-200 hover:text-white">
            AI Interview Prep
          </Link>
          <span className="truncate text-zinc-500">
            {config.tone} interviewer · {LANGUAGE_LABELS[config.language]}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Timer startedAt={session.startedAt} endedAt={session.endedAt} />
          <button
            type="button"
            onClick={finish}
            className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
          >
            I&apos;m done
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(280px,1fr)_2fr_320px]">
        <aside className="min-h-0 overflow-y-auto border-zinc-800 p-5 lg:border-r">
          <ProblemPanel problem={problem} />
        </aside>

        <section className="min-h-[400px] lg:min-h-0">
          <CodeEditor
            language={config.language}
            value={session.code}
            onChange={(code) => updateCode(id, code)}
          />
        </section>

        <aside className="flex min-h-0 flex-col border-zinc-800 lg:border-l">
          <div className="border-b border-zinc-800 px-4 py-3">
            {/* Click-to-talk mic. Wired to useVoice() in milestone 4. */}
            <MicButton state="idle" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <TranscriptPanel transcript={session.transcript} />
          </div>
          <div className="border-t border-zinc-800 p-3">
            <button
              type="button"
              onClick={requestHint}
              disabled={hintsLeft <= 0}
              className="w-full rounded-md border border-zinc-700 py-2 text-sm hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Can I get a hint? <span className="text-zinc-500">({hintsLeft} left)</span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
