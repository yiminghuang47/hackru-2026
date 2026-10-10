"use client";

import { useEffect, useRef } from "react";

// Ribbons of light that circle inside the orb. `orbit` and `size` are fractions
// of the orb radius; `speed` is turns of phase per second (negative = reverse).
const RIBBONS = [
  { rgb: "38,108,255", orbit: 0.42, size: 0.95, speed: 0.9, offset: 0 },
  { rgb: "56,198,255", orbit: 0.5, size: 0.7, speed: -1.25, offset: 2.1 },
  { rgb: "104,92,255", orbit: 0.36, size: 0.85, speed: 1.6, offset: 4.0 },
  { rgb: "20,70,200", orbit: 0.55, size: 1.05, speed: -0.6, offset: 1.0 },
  { rgb: "150,215,255", orbit: 0.28, size: 0.45, speed: 2.1, offset: 5.2 },
];

/**
 * The interviewer's "presence", Siri-style: a dark glass orb with ribbons of
 * blue light circling inside. While `speaking` they swirl faster, brighter and
 * wider, pulsing like syllables; while listening they drift slowly.
 */
export function VoiceOrb({ speaking, size = 300 }: { speaking: boolean; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speakingRef = useRef(speaking);

  useEffect(() => {
    speakingRef.current = speaking;
  }, [speaking]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    const c = size / 2;
    const R = size * 0.37;
    // With reduced motion, hold a single mid-speech frame.
    let level = reduceMotion ? 0.7 : speakingRef.current ? 1 : 0;
    // Phase is accumulated so speeding up while speaking never makes the swirl jump.
    let phase = reduceMotion ? 2.4 : 0;
    let last = 0;
    let raf = 0;

    function frame(now: number) {
      const t = now / 1000;
      if (!reduceMotion) {
        const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
        last = now;
        level += ((speakingRef.current ? 1 : 0) - level) * 0.07;
        phase += dt * (0.45 + level * 1.5);
      }
      // Syllable-like swell so speech doesn't look like a steady spin.
      const swell = 1 + level * 0.22 * Math.sin(t * 7.3 + Math.sin(t * 2.1) * 2);

      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, size, size);

      // Glow around the orb.
      const glow = ctx!.createRadialGradient(c, c, R * 0.7, c, c, size / 2);
      glow.addColorStop(0, `rgba(40,110,255,${0.14 + level * 0.2})`);
      glow.addColorStop(1, "rgba(40,110,255,0)");
      ctx!.fillStyle = glow;
      ctx!.fillRect(0, 0, size, size);

      ctx!.save();
      ctx!.beginPath();
      ctx!.arc(c, c, R, 0, Math.PI * 2);
      ctx!.clip();
      ctx!.fillStyle = "#040818";
      ctx!.fillRect(c - R, c - R, R * 2, R * 2);

      // Overlapping ribbons add up to brighter light where they cross.
      ctx!.globalCompositeOperation = "lighter";
      RIBBONS.forEach((ribbon, i) => {
        const angle = phase * ribbon.speed + ribbon.offset;
        const orbit = R * ribbon.orbit * (0.55 + 0.45 * level) * (1 + 0.18 * Math.sin(phase * 1.7 + i));
        const radius = R * ribbon.size * (0.75 + 0.25 * level) * swell;
        const alpha = 0.3 + 0.6 * level;

        ctx!.save();
        ctx!.translate(c + Math.cos(angle) * orbit, c + Math.sin(angle) * orbit);
        // Stretch along the direction of travel so each blob reads as a ribbon.
        ctx!.rotate(angle + Math.PI / 2);
        ctx!.scale(1.55, 0.7);
        const light = ctx!.createRadialGradient(0, 0, 0, 0, 0, radius);
        light.addColorStop(0, `rgba(${ribbon.rgb},${alpha})`);
        light.addColorStop(0.5, `rgba(${ribbon.rgb},${alpha * 0.35})`);
        light.addColorStop(1, `rgba(${ribbon.rgb},0)`);
        ctx!.fillStyle = light;
        ctx!.beginPath();
        ctx!.arc(0, 0, radius, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.restore();
      });
      ctx!.globalCompositeOperation = "source-over";

      // Darken toward the rim so it reads as a sphere of glass.
      const shade = ctx!.createRadialGradient(c, c, R * 0.45, c, c, R);
      shade.addColorStop(0, "rgba(4,8,24,0)");
      shade.addColorStop(1, "rgba(4,8,24,0.78)");
      ctx!.fillStyle = shade;
      ctx!.fillRect(c - R, c - R, R * 2, R * 2);
      ctx!.restore();

      ctx!.strokeStyle = `rgba(110,165,255,${0.35 + level * 0.35})`;
      ctx!.lineWidth = 1.2;
      ctx!.beginPath();
      ctx!.arc(c, c, R, 0, Math.PI * 2);
      ctx!.stroke();

      if (!reduceMotion) raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="max-w-full"
      style={{ width: size, height: size, aspectRatio: "1" }}
    />
  );
}
