"use client";

import { useEffect, useMemo, useState } from "react";
import { createConversation, IDLE_CONVERSATION } from "./conversation";
import { useSessionStore } from "./session";

export function useInterview(id: string) {
  const [state, setState] = useState(IDLE_CONVERSATION);
  const conversation = useMemo(() => createConversation({
    getSession: () => useSessionStore.getState().sessions[id],
    append: (entry) => useSessionStore.getState().addTranscript(id, entry),
    onState: setState,
  }), [id]);
  useEffect(() => () => conversation.dispose(), [conversation]);
  return { ...state, ...conversation, retryKind: state.retry };
}
