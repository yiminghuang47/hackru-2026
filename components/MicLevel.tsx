"use client";

import { useEffect, useRef } from "react";

const BARS = 5;
// Each bar lights up at a higher loudness, so a louder voice fills more of the meter.
const BAR_SCALE = [0.5, 0.8, 1, 0.8, 0.5];

/**
 * Live mic level next to the mic button. Reads `stream` with an AnalyserNode and
 * writes bar heights straight to the DOM, so the room doesn't re-render every frame.
 */
export function MicLevel({ stream }: { stream: MediaStream | null }) {
  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const bars = barsRef.current;
    const setLevel = (level: number) =>
      bars.forEach((bar, i) => {
        if (bar) bar.style.height = `${Math.max(15, Math.min(100, level * BAR_SCALE[i] * 100))}%`;
      });

    if (!stream) {
      setLevel(0);
      return;
    }

    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);

    let frame = 0;
    const tick = () => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const s of samples) sum += s * s;
      const rms = Math.sqrt(sum / samples.length);
      // Speech RMS sits around 0.02–0.2; stretch that range over the meter.
      setLevel(Math.min(1, rms * 8));
      frame = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      void ctx.close();
      setLevel(0);
    };
  }, [stream]);

  return (
    <div
      className="flex h-9 shrink-0 items-center gap-0.5 rounded-md border border-zinc-700 px-2"
      role="img"
      aria-label={stream ? "Mic level" : "Mic off"}
    >
      {Array.from({ length: BARS }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            barsRef.current[i] = el;
          }}
          className={`w-1 rounded-full transition-[height] duration-75 ${stream ? "bg-emerald-400" : "bg-zinc-600"}`}
          style={{ height: "15%" }}
        />
      ))}
    </div>
  );
}
