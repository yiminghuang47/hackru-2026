"use client";

import type { Problem } from "@/lib/types";

export function MyQuestionsList({
  questions,
  selectedId,
  onSelect,
  onDelete,
}: {
  questions: Problem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <ul className="space-y-2">
      {questions.map((q) => (
        <li
          key={q.id}
          className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 transition-colors ${
            selectedId === q.id ? "border-emerald-400 bg-emerald-400/10" : "border-zinc-800 hover:border-zinc-600"
          }`}
        >
          <button type="button" onClick={() => onSelect(q.id)} className="min-w-0 flex-1 text-left">
            <span className="block truncate font-medium">{q.title || "Untitled question"}</span>
            <span className="block text-sm text-zinc-400">
              {q.difficulty} · {q.topic}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete "${q.title}"?`)) onDelete(q.id);
            }}
            className="text-xs text-zinc-500 hover:text-rose-400"
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}
