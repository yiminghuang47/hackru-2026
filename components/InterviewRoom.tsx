"use client";

import { use, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSessionStore, useStoreHydrated } from "@/lib/session";
import { useVoice } from "@/lib/voice";
import { LANGUAGE_LABELS } from "@/lib/types";
import { ProblemPanel } from "@/components/ProblemPanel";
import { CodeEditor } from "@/components/CodeEditor";
import { Timer } from "@/components/Timer";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { CameraPreview } from "@/components/CameraPreview";
import { InterviewerPanel } from "@/components/InterviewerPanel";
import { ResizeHandle } from "@/components/ResizeHandle";

const LEFT_MIN = 220;
const LEFT_MAX = 640;
const RIGHT_MIN = 260;
const RIGHT_MAX = 600;
const RIGHT_DEFAULT = 360;
// Dragging the interviewer panel narrower than this hides it.
const RIGHT_HIDE_BELOW = 150;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function InterviewRoom({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const hydrated = useStoreHydrated();
  const session = useSessionStore((s) => s.sessions[id]);
  const updateCode = useSessionStore((s) => s.updateCode);
  const addTranscript = useSessionStore((s) => s.addTranscript);
  const recordHint = useSessionStore((s) => s.recordHint);
  const endSession = useSessionStore((s) => s.endSession);

  // Panel widths in px (desktop layout). The editor takes whatever is left.
  const [leftWidth, setLeftWidth] = useState(340);
  const [rightWidth, setRightWidth] = useState(RIGHT_DEFAULT);
  const [interviewerHidden, setInterviewerHidden] = useState(false);
  const dragStartWidth = useRef(0);

  const voice = useVoice({
    onUtterance: (text) => addTranscript(id, { role: "candidate", text }),
  });

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

  function dragInterviewer(dx: number) {
    const width = dragStartWidth.current - dx;
    if (width < RIGHT_HIDE_BELOW) {
      setInterviewerHidden(true);
    } else {
      setInterviewerHidden(false);
      setRightWidth(clamp(width, RIGHT_MIN, RIGHT_MAX));
    }
  }

  const columns = interviewerHidden
    ? `${leftWidth}px 9px minmax(0,1fr) 30px`
    : `${leftWidth}px 9px minmax(0,1fr) 9px ${rightWidth}px`;

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

      <div
        className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-(--room-columns)"
        style={{ "--room-columns": columns } as React.CSSProperties}
      >
        <aside className="flex min-h-0 min-w-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <ProblemPanel problem={problem} />
          </div>
          <div className="p-4 pt-2">
            <div className="max-w-[230px]">
              <CameraPreview />
            </div>
          </div>
        </aside>

        <ResizeHandle
          label="Resize problem panel"
          onDragStart={() => (dragStartWidth.current = leftWidth)}
          onDrag={(dx) => setLeftWidth(clamp(dragStartWidth.current + dx, LEFT_MIN, LEFT_MAX))}
        />

        <section className="min-h-[400px] min-w-0 lg:min-h-0">
          <CodeEditor
            language={config.language}
            value={session.code}
            onChange={(code) => updateCode(id, code)}
          />
        </section>

        {interviewerHidden ? (
          // Collapsed interviewer: click the tab, or drag it left, to bring it back.
          <ResizeHandle
            label="Show interviewer"
            onDragStart={() => (dragStartWidth.current = 0)}
            onDrag={dragInterviewer}
            onClick={() => setInterviewerHidden(false)}
            className="border-l border-zinc-800 bg-zinc-900 hover:bg-zinc-800"
          >
            <span className="m-auto flex items-center gap-2 text-xs text-zinc-300 [writing-mode:vertical-rl]">
              <span aria-hidden>‹</span> Interviewer
            </span>
          </ResizeHandle>
        ) : (
          <ResizeHandle
            label="Resize interviewer panel"
            onDragStart={() => (dragStartWidth.current = rightWidth)}
            onDrag={dragInterviewer}
          />
        )}

        {/* Kept mounted while hidden so the interviewer's state carries on. */}
        <aside className={`min-h-0 min-w-0 flex-col ${interviewerHidden ? "flex lg:hidden" : "flex"}`}>
          <div className="relative border-b border-zinc-800">
            <button
              type="button"
              onClick={() => setInterviewerHidden(true)}
              title="Hide the interviewer for more coding space"
              className="absolute right-2 top-2 z-10 hidden rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 lg:block"
            >
              Hide <span aria-hidden>›</span>
            </button>
            <InterviewerPanel
              voiceId={config.voiceId}
              tone={config.tone}
              transcript={session.transcript}
              startedAt={session.startedAt}
              mic={{ state: voice.state, error: voice.error, stream: voice.stream, onClick: voice.toggleRecording }}
            />
          </div>
          <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Transcript
          </p>
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
