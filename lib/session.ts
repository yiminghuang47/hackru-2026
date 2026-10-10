"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Problem, Session, SessionConfig, TranscriptEntry } from "./types";
import type { Scorecard } from "./scorecard";
import { pickProblem } from "./problems";

type SessionStore = {
  sessions: Record<string, Session>;
  /** Uses `problem` if given (a custom question), otherwise picks one from the bank. */
  createSession: (config: SessionConfig, problem?: Problem) => string;
  updateCode: (id: string, code: string) => void;
  addTranscript: (id: string, entry: Omit<TranscriptEntry, "at">) => void;
  recordHint: (id: string) => void;
  endSession: (id: string) => void;
  setScorecard: (id: string, scorecard: Scorecard) => void;
};

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => {
      const patch = (id: string, fn: (s: Session) => Partial<Session>) => {
        const s = get().sessions[id];
        if (!s) return;
        set({ sessions: { ...get().sessions, [id]: { ...s, ...fn(s) } } });
      };

      return {
        sessions: {},
        createSession: (config, customProblem) => {
          const id = crypto.randomUUID();
          const problem = customProblem ?? pickProblem(config.topic, config.difficulty);
          const session: Session = {
            id,
            config,
            problem,
            code: problem.starterCode[config.language],
            transcript: [],
            hintsUsed: 0,
            startedAt: Date.now(),
          };
          set({ sessions: { ...get().sessions, [id]: session } });
          return id;
        },
        updateCode: (id, code) => patch(id, () => ({ code })),
        addTranscript: (id, entry) =>
          patch(id, (s) => ({
            transcript: [...s.transcript, { ...entry, at: Date.now() - s.startedAt }],
          })),
        recordHint: (id) => patch(id, (s) => ({ hintsUsed: s.hintsUsed + 1 })),
        endSession: (id) => patch(id, (s) => ({ endedAt: s.endedAt ?? Date.now() })),
        setScorecard: (id, scorecard) => patch(id, () => ({ scorecard })),
      };
    },
    { name: "interview-sessions" },
  ),
);

/** True once the persisted store has loaded from localStorage on the client. */
export function useStoreHydrated() {
  return useSyncExternalStore(
    (onChange) => useSessionStore.persist.onFinishHydration(onChange),
    () => useSessionStore.persist.hasHydrated(),
    () => false,
  );
}
