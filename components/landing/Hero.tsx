"use client";

import { AgentDemo } from "./AgentDemo";

const ABILITIES = ["Listens", "Asks why", "Gives hints", "Scores you"];

/** Opening screen: introduces the AI interviewer, with it "talking" beside the pitch. */
export function Hero() {
  return (
    <section id="top" className="flex min-h-svh flex-col py-8">
      <p className="font-mono text-sm tracking-wide text-zinc-400">
        interview<span className="text-accent">/</span>prep
      </p>

      <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.1fr_1fr] lg:gap-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-accent">
            AI voice interviewer
          </p>
          <h1 className="mt-5 font-display text-[clamp(3.25rem,7vw,6.5rem)] leading-[0.98] tracking-tight">
            Meet your
            <br />
            interviewer.
          </h1>
          <p className="mt-7 max-w-md text-lg text-zinc-300">
            An AI that interviews you out loud. It listens while you code, asks why you chose
            that approach, and gives a hint when you&apos;re stuck.
          </p>
          <button
            type="button"
            onClick={() =>
              document.getElementById("setup")?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="mt-9 inline-flex items-center gap-3 rounded-full bg-accent px-7 py-3.5 font-semibold text-zinc-950 transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            Start a mock interview
            <span aria-hidden>↓</span>
          </button>
          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs uppercase tracking-widest text-zinc-500">
            {ABILITIES.map((a) => (
              <li key={a} className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-accent" aria-hidden />
                {a}
              </li>
            ))}
          </ul>
        </div>

        <AgentDemo />
      </div>
    </section>
  );
}
