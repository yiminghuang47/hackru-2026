export type MicState = "idle" | "recording" | "thinking" | "interviewer";

const STATES: Record<MicState, { label: string; dot: string }> = {
  idle: { label: "Click to talk", dot: "bg-zinc-500" },
  recording: { label: "Recording… click to send", dot: "bg-red-500 animate-pulse" },
  thinking: { label: "Interviewer is thinking…", dot: "bg-sky-400 animate-pulse" },
  interviewer: { label: "Interviewer speaking · click to interrupt", dot: "bg-amber-400 animate-pulse" },
};

/**
 * Click-to-talk mic. The first click starts recording, the second stops it and sends the turn.
 * Driven by `useVoice()` in `lib/voice.ts`; disabled until an `onClick` is passed.
 */
export function MicButton({ state, onClick }: { state: MicState; onClick?: () => void }) {
  const { label, dot } = STATES[state];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick || state === "thinking"}
      aria-pressed={state === "recording"}
      className="flex w-full items-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      {label}
    </button>
  );
}
