"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Problem } from "./types";

type CustomQuestionStore = {
  questions: Problem[]; // newest first
  save: (problem: Problem) => void; // inserts, or replaces the question with the same id
  remove: (id: string) => void;
};

/** "My questions": custom questions Gemini has formatted, kept for reuse. */
export const useCustomQuestions = create<CustomQuestionStore>()(
  persist(
    (set, get) => ({
      questions: [],
      save: (problem) => {
        const rest = get().questions.filter((q) => q.id !== problem.id);
        set({ questions: [problem, ...rest] });
      },
      remove: (id) => set({ questions: get().questions.filter((q) => q.id !== id) }),
    }),
    { name: "custom-questions" },
  ),
);
