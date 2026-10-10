"use client";

import { useEffect, useRef } from "react";

const SIZE = 30;
// Arrow tip inside the 24x24 icon, scaled to SIZE. This is the click point.
const TIP = (4.5 / 24) * SIZE;
// The five sparks around the tip in the icon: up, up-right, up-left, left, down-left.
const RAY_ANGLES = [-90, -45, -135, 180, 135];
const POP_MS = 560;

/** Sparks burst out of the arrow tip at (x, y), then fade. */
function pop(x: number, y: number) {
  const root = document.createElement("div");
  root.setAttribute("aria-hidden", "true");
  root.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:0;height:0;pointer-events:none;z-index:9998`;

  const glow = document.createElement("div");
  glow.style.cssText =
    "position:absolute;left:-40px;top:-40px;width:80px;height:80px;border-radius:9999px;background:radial-gradient(circle,rgba(255,255,255,0.4),rgba(255,255,255,0) 68%)";
  root.appendChild(glow);
  glow.animate(
    [
      { transform: "scale(0.3)", opacity: 1 },
      { transform: "scale(1.5)", opacity: 0 },
    ],
    { duration: POP_MS + 200, easing: "ease-out", fill: "forwards" },
  );

  for (const angle of RAY_ANGLES) {
    const ray = document.createElement("div");
    ray.style.cssText = `position:absolute;left:-1.25px;top:0;width:2.5px;height:8px;border-radius:2px;background:#fff;transform-origin:50% 0;transform:rotate(${angle - 90}deg) translateY(10px)`;
    root.appendChild(ray);
    ray.animate(
      [
        { transform: `rotate(${angle - 90}deg) translateY(6px) scaleY(0.3)`, opacity: 1 },
        { transform: `rotate(${angle - 90}deg) translateY(12px) scaleY(1)`, opacity: 1, offset: 0.35 },
        { transform: `rotate(${angle - 90}deg) translateY(24px) scaleY(0.6)`, opacity: 0 },
      ],
      { duration: POP_MS, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)", fill: "forwards" },
    );
  }

  document.body.appendChild(root);
  setTimeout(() => root.remove(), POP_MS + 250);
}

/**
 * Replaces the system cursor with an outlined arrow. Clicking pops sparks out
 * of its tip. Skipped on touch devices; over text fields it hides so the normal
 * text cursor shows.
 *
 * Position lives on the outer element and hover/press scaling on the inner one,
 * pivoting on the tip, so changing state can never move the pointer.
 */
export function Cursor() {
  const posRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pos = posRef.current;
    const body = bodyRef.current;
    if (!pos || !body || !window.matchMedia("(pointer: fine)").matches) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.documentElement.classList.add("custom-cursor");

    let pressed = false;
    let hovering = false;

    function setState() {
      const scale = pressed ? 0.88 : hovering ? 1.18 : 1;
      body!.style.transform = `scale(${scale}) rotate(${pressed ? -10 : 0}deg)`;
    }

    const onMove = (e: PointerEvent) => {
      pos.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      pos.style.opacity = "1";
      const target = e.target instanceof Element ? e.target : null;
      pos.style.visibility = target?.closest("input, textarea") ? "hidden" : "visible";
      const next = !!target?.closest("button, a, [role='button']");
      if (next !== hovering) {
        hovering = next;
        setState();
      }
    };
    const onDown = (e: PointerEvent) => {
      pressed = true;
      setState();
      if (!reduceMotion) pop(e.clientX, e.clientY);
    };
    const onUp = () => {
      pressed = false;
      setState();
    };
    const onLeave = () => {
      pos.style.opacity = "0";
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    document.addEventListener("pointerleave", onLeave);
    return () => {
      document.documentElement.classList.remove("custom-cursor");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div
      ref={posRef}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[9999] opacity-0"
    >
      <div
        ref={bodyRef}
        className="transition-transform duration-150 ease-out"
        style={{
          width: SIZE,
          height: SIZE,
          marginLeft: -TIP,
          marginTop: -TIP,
          transformOrigin: `${TIP}px ${TIP}px`,
        }}
      >
        <svg viewBox="0 0 24 24" width={SIZE} height={SIZE} className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
          <path
            d="M4.5 4.5 L20.5 9.8 C21.6 10.2 21.5 11.2 20.4 11.5 L14.8 12.8 L12.2 19.8 C11.8 20.9 10.8 20.8 10.4 19.8 Z"
            fill="#070c1d"
            stroke="#fff"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
