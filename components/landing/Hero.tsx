"use client";

/** Opening screen: one bold line, one sentence, one button. */
export function Hero() {
  return (
    <section id="top" className="flex min-h-svh flex-col justify-between py-8">
      <p className="font-mono text-sm tracking-wide text-zinc-400">
        interview<span className="text-accent">/</span>prep
      </p>

      <div>
        <h1 className="font-display text-[clamp(3.5rem,11vw,9rem)] leading-[0.92] tracking-tight">
          Talk it through
          <br />
          <span className="italic text-accent">before it counts.</span>
          <span className="caret ml-1 inline-block h-[0.75em] w-[0.06em] translate-y-[0.05em] bg-accent align-baseline" />
        </h1>
        <p className="mt-8 max-w-xl text-lg text-zinc-300">
          Pick a topic and an interviewer. You&apos;ll solve one problem out loud while the
          interviewer listens, asks questions and gives hints when you need them.
        </p>
        <button
          type="button"
          onClick={() =>
            document.getElementById("setup")?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          className="mt-10 inline-flex items-center gap-3 rounded-full bg-accent px-7 py-3.5 font-semibold text-zinc-950 transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          Set up your interview
          <span aria-hidden>↓</span>
        </button>
      </div>

      <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">
        Scroll <span aria-hidden>↓</span>
      </p>
    </section>
  );
}
