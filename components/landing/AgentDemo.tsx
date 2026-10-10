"use client";

import { useEffect, useState } from "react";
import { VoiceOrb } from "@/components/VoiceOrb";

type Turn = { who: "agent" | "you"; text: string };

// A scripted sample of what a session sounds like. Not a live call.
const SCRIPT: Turn[] = [
  { who: "agent", text: "Before you code, walk me through your approach." },
  { who: "you", text: "I'd keep two pointers and move the smaller side in." },
  { who: "agent", text: "Why two pointers and not a hash map?" },
  { who: "you", text: "The array is sorted, so I can do it in constant space." },
  { who: "agent", text: "Good. Are you sure about the empty-array case?" },
  { who: "you", text: "Hmm. Can I get a hint?" },
  { who: "agent", text: "Check what your loop does when left meets right." },
];

const TYPE_MS = 32;
const HOLD_MS = 1500;

/** Hero centrepiece: the voice orb plus a sample exchange that types itself out. */
export function AgentDemo() {
  const [turn, setTurn] = useState(0);
  const [chars, setChars] = useState(0);

  const current = SCRIPT[turn];
  const previous = turn > 0 ? SCRIPT[turn - 1] : null;
  const typing = chars < current.text.length;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // No typing or cycling: show the first exchange in full.
      const id = setTimeout(() => {
        setTurn(1);
        setChars(SCRIPT[1].text.length);
      }, 0);
      return () => clearTimeout(id);
    }
    const id = setTimeout(
      () => {
        if (typing) {
          setChars((n) => n + 1);
        } else {
          setTurn((i) => (i + 1) % SCRIPT.length);
          setChars(0);
        }
      },
      typing ? TYPE_MS : HOLD_MS,
    );
    return () => clearTimeout(id);
  }, [turn, chars, typing]);

  const agentSpeaking = current.who === "agent" && typing;

  return (
    <figure className="mx-auto w-full max-w-md">
      <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/70 px-6 pb-7 pt-5">
        <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest">
          <span
            className={`h-1.5 w-1.5 rounded-full ${agentSpeaking ? "bg-accent" : "bg-zinc-500"}`}
          />
          <span className={agentSpeaking ? "text-accent" : "text-zinc-500"}>
            {agentSpeaking ? "Interviewer speaking" : "Listening to you"}
          </span>
        </p>

        <div className="flex justify-center">
          <VoiceOrb speaking={agentSpeaking} />
        </div>

        {/* Fixed height so the hero doesn't shift as lines type in. */}
        <div className="flex h-28 flex-col justify-end gap-3" aria-hidden>
          {previous && <Line turn={previous} text={previous.text} dim />}
          <Line turn={current} text={current.text.slice(0, chars)} caret={typing} />
        </div>
      </div>

      <figcaption className="mt-4 text-center font-mono text-[11px] uppercase tracking-widest text-zinc-500">
        Sample exchange
      </figcaption>
    </figure>
  );
}

function Line({
  turn,
  text,
  dim = false,
  caret = false,
}: {
  turn: Turn;
  text: string;
  dim?: boolean;
  caret?: boolean;
}) {
  const agent = turn.who === "agent";
  return (
    <p className={`transition-opacity duration-500 ${dim ? "opacity-40" : ""}`}>
      <span
        className={`block font-mono text-[11px] uppercase tracking-widest ${
          agent ? "text-accent" : "text-zinc-500"
        }`}
      >
        {agent ? "Interviewer" : "You"}
      </span>
      <span className={`text-lg leading-snug ${agent ? "text-zinc-100" : "text-zinc-300"}`}>
        {text}
        {caret && <span className="caret ml-0.5 inline-block h-[1em] w-px translate-y-[0.15em] bg-current" />}
      </span>
    </p>
  );
}
