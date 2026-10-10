"use client";

import { useState } from "react";
import {
  DIFFICULTIES,
  MAX_QUESTION_CHARS,
  type Difficulty,
  type ParseQuestionResponse,
  type Problem,
} from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-emerald-400";

/** Paste a rough question description; Gemini formats it into a full Problem. */
export function CustomQuestionForm({
  onFormatted,
  onCancel,
}: {
  onFormatted: (problem: Problem) => void;
  onCancel?: () => void;
}) {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooLong = text.length > MAX_QUESTION_CHARS;
  const canSubmit = text.trim().length > 0 && !tooLong && !loading;

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/problem/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          title: title.trim() || undefined,
          difficulty: difficulty || undefined,
          topic: topic.trim() || undefined,
        }),
      });
      const data = (await res.json()) as ParseQuestionResponse;
      if (data.ok) onFormatted(data.problem);
      else setError(data.reason);
    } catch {
      setError("Couldn't reach the server. Is the dev server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-zinc-800 p-4">
      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={
            "Describe the question in your own words, or paste a full problem.\n\n" +
            "e.g. Given a list of meeting time intervals, find the minimum number of rooms needed so no meetings overlap."
          }
          className={`${inputClass} resize-y font-mono leading-relaxed`}
        />
        <p className={`mt-1 text-right text-xs ${tooLong ? "text-rose-400" : "text-zinc-500"}`}>
          {text.length.toLocaleString()} / {MAX_QUESTION_CHARS.toLocaleString()}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className={inputClass}
        />
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty | "")}
          className={inputClass}
        >
          <option value="">Difficulty: let Gemini decide</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Topic (optional)"
          className={inputClass}
        />
      </div>

      {error && <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Formatting…" : "Format with Gemini"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
