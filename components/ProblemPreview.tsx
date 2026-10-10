"use client";

import { DIFFICULTIES, type Difficulty, type Problem } from "@/lib/types";

const inputClass =
  "w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-emerald-400";

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-xs font-semibold text-zinc-400">{children}</span>;
}

/**
 * Editable view of a formatted question so the candidate can fix anything
 * Gemini got wrong. The reference solution and hints stay hidden to avoid spoilers.
 */
export function ProblemPreview({
  problem,
  onChange,
}: {
  problem: Problem;
  onChange: (problem: Problem) => void;
}) {
  const set = (patch: Partial<Problem>) => onChange({ ...problem, ...patch });

  const setExample = (i: number, patch: Partial<Problem["examples"][number]>) =>
    set({ examples: problem.examples.map((ex, j) => (j === i ? { ...ex, ...patch } : ex)) });

  return (
    <div className="space-y-4 rounded-lg border border-zinc-800 p-4">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <label>
          <Label>Title</Label>
          <input value={problem.title} onChange={(e) => set({ title: e.target.value })} className={inputClass} />
        </label>
        <label>
          <Label>Difficulty</Label>
          <select
            value={problem.difficulty}
            onChange={(e) => set({ difficulty: e.target.value as Difficulty })}
            className={inputClass}
          >
            {DIFFICULTIES.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label>
          <Label>Topic</Label>
          <input value={problem.topic} onChange={(e) => set({ topic: e.target.value })} className={inputClass} />
        </label>
      </div>

      <label className="block">
        <Label>Statement</Label>
        <textarea
          value={problem.statement}
          onChange={(e) => set({ statement: e.target.value })}
          rows={5}
          className={`${inputClass} resize-y leading-relaxed`}
        />
      </label>

      <div className="space-y-2">
        <Label>Examples</Label>
        {problem.examples.map((ex, i) => (
          <div key={i} className="space-y-2 rounded-md bg-zinc-900/60 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Example {i + 1}</span>
              <button
                type="button"
                onClick={() => set({ examples: problem.examples.filter((_, j) => j !== i) })}
                className="text-xs text-zinc-500 hover:text-rose-400"
              >
                Remove
              </button>
            </div>
            <input
              value={ex.input}
              onChange={(e) => setExample(i, { input: e.target.value })}
              placeholder="Input"
              className={`${inputClass} font-mono text-xs`}
            />
            <input
              value={ex.output}
              onChange={(e) => setExample(i, { output: e.target.value })}
              placeholder="Output"
              className={`${inputClass} font-mono text-xs`}
            />
            <input
              value={ex.explanation ?? ""}
              onChange={(e) => setExample(i, { explanation: e.target.value || undefined })}
              placeholder="Explanation (optional)"
              className={`${inputClass} text-xs`}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => set({ examples: [...problem.examples, { input: "", output: "" }] })}
          className="text-xs text-emerald-400 hover:underline"
        >
          + Add example
        </button>
      </div>

      <label className="block">
        <Label>Constraints (one per line)</Label>
        <textarea
          value={problem.constraints.join("\n")}
          onChange={(e) => set({ constraints: e.target.value.split("\n") })}
          rows={3}
          className={`${inputClass} resize-y font-mono text-xs`}
        />
      </label>

      <p className="text-xs text-zinc-500">
        Gemini also wrote starter code, edge cases, a reference solution and {problem.hintLadder.length} hints.
        They stay hidden until the interview so they don&apos;t spoil the question.
      </p>
    </div>
  );
}
