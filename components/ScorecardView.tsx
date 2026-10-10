import {
  SCORE_KEYS,
  SCORE_LABELS,
  type Scorecard,
  type Verdict,
} from "@/lib/scorecard";

const VERDICT_COLORS: Record<Verdict, string> = {
  Hire: "border-emerald-400 text-emerald-400",
  "Lean Hire": "border-emerald-400/60 text-emerald-300",
  "Lean No Hire": "border-amber-400/70 text-amber-400",
  "No Hire": "border-rose-400/70 text-rose-400",
};

function formatClock(ms: number) {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** The scored result of an interview: overall score, per-area scores and written feedback. */
export function ScorecardView({ scorecard }: { scorecard: Scorecard }) {
  return (
    <div className="space-y-8">
      <section className="grid gap-6 rounded-xl border border-zinc-800 p-6 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-10">
        <div>
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            Overall score
          </p>
          <p className="font-display text-7xl leading-none">
            {scorecard.overall}
            <span className="text-2xl text-zinc-500"> / 100</span>
          </p>
          <p
            className={`mt-4 inline-block rounded-full border px-3 py-1 text-sm font-semibold ${VERDICT_COLORS[scorecard.verdict]}`}
          >
            {scorecard.verdict}
          </p>
          {scorecard.hintPenalty > 0 && (
            <p className="mt-2 text-xs text-zinc-500">
              Includes −{scorecard.hintPenalty} for hints used
            </p>
          )}
        </div>

        <div className="space-y-3">
          {SCORE_KEYS.map((key) => (
            <div key={key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-zinc-300">{SCORE_LABELS[key]}</span>
                <span className="font-mono text-zinc-400">
                  {scorecard.scores[key]} / 5
                </span>
              </div>
              <div
                className="mt-1 h-1.5 rounded-full bg-zinc-800"
                role="meter"
                aria-label={SCORE_LABELS[key]}
                aria-valuemin={0}
                aria-valuemax={5}
                aria-valuenow={scorecard.scores[key]}
              >
                <div
                  className="h-full rounded-full bg-emerald-400"
                  style={{ width: `${(scorecard.scores[key] / 5) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="text-lg leading-relaxed text-zinc-200">
        {scorecard.summary}
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        <FeedbackList
          title="What went well"
          items={scorecard.strengths}
          empty="Nothing stood out this time."
        />
        <FeedbackList
          title="What to work on"
          items={scorecard.improvements}
          empty="No specific suggestions."
        />
      </div>

      <FeedbackList
        title="Bugs and missed edge cases"
        items={scorecard.bugs}
        empty="None found in your final code."
      />

      {scorecard.keyMoments.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-300">Key moments</h2>
          <ul className="space-y-2 text-sm">
            {scorecard.keyMoments.map((m, i) => (
              <li key={i} className="flex gap-3">
                <span className="shrink-0 font-mono text-zinc-500">
                  {formatClock(m.atMs)}
                </span>
                <span className="text-zinc-200">{m.note}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="rounded-lg border border-zinc-800">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-zinc-300">
          Show an optimal solution
        </summary>
        <div className="space-y-3 border-t border-zinc-800 p-4">
          <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 font-mono text-xs leading-relaxed">
            {scorecard.optimalSolution}
          </pre>
          <p className="text-sm text-zinc-300">{scorecard.explanation}</p>
        </div>
      </details>
    </div>
  );
}

function FeedbackList({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-zinc-300">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">{empty}</p>
      ) : (
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-200">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
