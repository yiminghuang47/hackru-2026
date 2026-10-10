export type VadState = "idle" | "listening" | "speaking" | "interviewer";

const STATES: Record<VadState, { label: string; dot: string }> = {
  idle: { label: "Mic not started", dot: "bg-zinc-600" },
  listening: { label: "Listening", dot: "bg-emerald-400" },
  speaking: { label: "You're speaking", dot: "bg-sky-400 animate-pulse" },
  interviewer: { label: "Interviewer speaking", dot: "bg-amber-400 animate-pulse" },
};

/** Shows what the always-on mic is doing. Driven by the VAD in milestone 3. */
export function VadIndicator({ state }: { state: VadState }) {
  const { label, dot } = STATES[state];
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-300">
      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      {label}
    </div>
  );
}
