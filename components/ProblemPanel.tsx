import type { Problem } from "@/lib/types";

const DIFFICULTY_COLORS: Record<Problem["difficulty"], string> = {
  Easy: "text-emerald-400",
  Medium: "text-amber-400",
  Hard: "text-rose-400",
};

export function ProblemPanel({ problem }: { problem: Problem }) {
  return (
    <div className="space-y-5 text-sm leading-relaxed">
      <div>
        <h1 className="text-lg font-semibold">{problem.title}</h1>
        <p className="mt-1 text-xs">
          <span className={DIFFICULTY_COLORS[problem.difficulty]}>{problem.difficulty}</span>
          <span className="text-zinc-500"> · {problem.topic}</span>
          {problem.source === "custom" && <span className="text-zinc-500"> · Custom question</span>}
        </p>
      </div>

      <p className="text-zinc-200">{problem.statement}</p>

      {problem.examples.map((ex, i) => (
        <div key={i} className="space-y-1 rounded-lg bg-zinc-900 p-3 font-mono text-xs">
          <p className="font-sans text-xs font-semibold text-zinc-400">Example {i + 1}</p>
          <p>
            <span className="text-zinc-500">Input: </span>
            {ex.input}
          </p>
          <p>
            <span className="text-zinc-500">Output: </span>
            {ex.output}
          </p>
          {ex.explanation && (
            <p className="font-sans text-zinc-400">
              <span className="text-zinc-500">Explanation: </span>
              {ex.explanation}
            </p>
          )}
        </div>
      ))}

      <div>
        <p className="mb-1 text-xs font-semibold text-zinc-400">Constraints</p>
        <ul className="list-disc space-y-0.5 pl-5 font-mono text-xs text-zinc-300">
          {problem.constraints.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
