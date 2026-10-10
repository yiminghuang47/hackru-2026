"use client";

import { useEffect, useState } from "react";

/** Floating bar that appears once you scroll past the hero: your picks + the start button. */
export function SummaryBar({
  items,
  canStart,
  onStart,
}: {
  items: string[];
  canStart: boolean;
  onStart: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 transition-all duration-500 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"
      }`}
    >
      <div className="flex w-full max-w-3xl items-center justify-between gap-4 rounded-2xl border border-zinc-700 bg-zinc-950/90 py-2.5 pl-5 pr-2.5 backdrop-blur">
        <p className="truncate font-mono text-xs text-zinc-300 sm:text-sm">
          {items.join(" · ")}
        </p>
        <button
          type="button"
          onClick={onStart}
          disabled={!canStart}
          className="shrink-0 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-all hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start interview →
        </button>
      </div>
    </div>
  );
}
