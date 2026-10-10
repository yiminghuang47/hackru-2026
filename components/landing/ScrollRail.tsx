"use client";

import { useEffect, useState } from "react";

export type RailSection = { id: string; label: string };

/**
 * Replaces the native scrollbar: a thin rail on the right edge with a progress
 * fill, one tick per section (click to jump) and a live percentage.
 */
export function ScrollRail({ sections }: { sections: RailSection[] }) {
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(0);

  useEffect(() => {
    function onScroll() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
      const line = window.innerHeight * 0.4;
      let current = 0;
      sections.forEach((s, i) => {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= line) current = i;
      });
      // The last section rarely reaches the trigger line, so claim the bottom of the page.
      if (max > 0 && window.scrollY >= max - 4) current = sections.length - 1;
      setActive(current);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sections]);

  function jump(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav
      aria-label="Page sections"
      className="fixed right-5 top-1/2 z-30 hidden -translate-y-1/2 items-stretch gap-3 md:flex"
    >
      <ol className="flex flex-col items-end justify-between gap-5 py-1">
        {sections.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => jump(s.id)}
              aria-current={i === active ? "true" : undefined}
              className={`group flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest transition-colors ${
                i === active ? "text-accent" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <span
                className={`transition-all ${
                  i === active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                {s.label}
              </span>
              <span className="tabular-nums">{String(i).padStart(2, "0")}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="relative w-px bg-zinc-700/70" aria-hidden>
        <div
          className="absolute left-0 top-0 w-px bg-accent"
          style={{ height: `${progress * 100}%` }}
        />
        <div
          className="absolute -left-[3px] h-[7px] w-[7px] rounded-full bg-accent shadow-[0_0_12px_2px_rgba(79,141,255,0.6)]"
          style={{ top: `calc(${progress * 100}% - 3px)` }}
        />
      </div>
      <span
        className="self-end font-mono text-[11px] tabular-nums text-zinc-500"
        aria-hidden
      >
        {Math.round(progress * 100)}%
      </span>
    </nav>
  );
}
