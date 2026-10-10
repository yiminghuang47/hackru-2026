"use client";

import { useRef, useState } from "react";

const KEY_STEP = 24;
// Movement below this counts as a click, not a drag.
const CLICK_SLOP = 4;

/**
 * A vertical divider you drag sideways to resize the panels beside it.
 * `onDrag` gets the horizontal distance from where the drag began, so the
 * parent should remember its starting width in `onDragStart`. Arrow keys nudge
 * it too. Pass `children` to render it as a wider tab (e.g. a collapsed panel).
 */
export function ResizeHandle({
  label,
  onDragStart,
  onDrag,
  onClick,
  className = "",
  children,
}: {
  label: string;
  onDragStart: () => void;
  onDrag: (dx: number) => void;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}) {
  const startX = useRef(0);
  const moved = useRef(false);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      tabIndex={0}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        startX.current = e.clientX;
        moved.current = false;
        setDragging(true);
        onDragStart();
      }}
      onPointerMove={(e) => {
        if (!dragging) return;
        const dx = e.clientX - startX.current;
        if (Math.abs(dx) > CLICK_SLOP) moved.current = true;
        if (moved.current) onDrag(dx);
      }}
      onPointerUp={() => {
        if (!dragging) return;
        setDragging(false);
        if (!moved.current) onClick?.();
      }}
      onPointerCancel={() => setDragging(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          onDragStart();
          onDrag(e.key === "ArrowLeft" ? -KEY_STEP : KEY_STEP);
        } else if ((e.key === "Enter" || e.key === " ") && onClick) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`group relative hidden shrink-0 cursor-col-resize touch-none select-none outline-none lg:flex ${className}`}
    >
      {children ?? (
        <span
          className={`mx-auto h-full w-px transition-all group-hover:w-[3px] group-hover:bg-emerald-400 group-focus-visible:w-[3px] group-focus-visible:bg-emerald-400 ${
            dragging ? "w-[3px] bg-emerald-400" : "bg-zinc-800"
          }`}
        />
      )}
    </div>
  );
}
