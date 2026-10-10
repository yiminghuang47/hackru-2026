import type { Session, TranscriptEntry } from "./types";
import type { InterviewerRequest } from "./interviewer";

export type ConversationState = {
  phase: "idle" | "thinking" | "loading-audio" | "speaking";
  error: string | null;
  retry: "turn" | "audio" | null;
};
export const IDLE_CONVERSATION: ConversationState = { phase: "idle", error: null, retry: null };
type Turn = { payload: InterviewerRequest; voiceId: string };
type AudioPlayer = Pick<HTMLAudioElement, "play" | "pause" | "onended" | "onerror">;

/** Owns one turn at a time. UI, mic, and typed input all use this same flow. */
export function createConversation(options: {
  getSession: () => Session | undefined;
  append: (entry: Omit<TranscriptEntry, "at">) => void;
  onState: (state: ConversationState) => void;
  fetch?: typeof fetch;
  makeAudio?: (url: string) => AudioPlayer;
}) {
  const request = options.fetch ?? fetch;
  let state = IDLE_CONVERSATION;
  let revision = 0;
  let abort: AbortController | undefined;
  let player: AudioPlayer | undefined;
  let audioUrl: string | undefined;
  let cachedAudio: Blob | undefined;
  let pending: Turn | undefined;
  let lastReply: string | undefined;
  let lastVoice: string | undefined;
  const update = (next: ConversationState) => { state = next; options.onState(next); };
  const releaseAudio = () => {
    if (player) { player.onended = null; player.onerror = null; player.pause(); player = undefined; }
    if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = undefined; }
  };
  const dispose = () => {
    revision++;
    abort?.abort();
    releaseAudio();
    cachedAudio = undefined;
    pending = undefined;
    lastReply = undefined;
    state = IDLE_CONVERSATION;
  };
  const stop = () => { dispose(); update(IDLE_CONVERSATION); };
  const errorMessage = (error: unknown) => error instanceof Error ? error.message : "The request failed. Please try again.";
  const jsonRequest = async (path: string, body: unknown, signal: AbortSignal) => request(path, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal,
  });
  const errorResponse = async (response: Response) => {
    const data = await response.json().catch(() => null);
    return new Error(data?.reason || `The request failed (${response.status}). Please try again.`);
  };

  async function speak(token: number, signal: AbortSignal) {
    update({ phase: "loading-audio", error: null, retry: null });
    try {
      if (!cachedAudio) {
        const response = await jsonRequest("/api/tts", { text: lastReply, voiceId: lastVoice }, signal);
        if (!response.ok) throw await errorResponse(response);
        if (!response.headers.get("content-type")?.startsWith("audio/")) throw new Error("Speech returned an invalid audio response.");
        const blob = await response.blob();
        if (token !== revision) return;
        if (!blob.size) throw new Error("Speech returned an empty recording.");
        cachedAudio = blob;
      }
      if (token !== revision) return;
      releaseAudio();
      audioUrl = URL.createObjectURL(cachedAudio);
      player = (options.makeAudio ?? ((url) => new Audio(url)))(audioUrl);
      player.onended = () => {
        if (token !== revision) return;
        releaseAudio(); cachedAudio = undefined;
        update(IDLE_CONVERSATION);
      };
      player.onerror = () => {
        if (token !== revision) return;
        releaseAudio();
        update({ phase: "idle", error: "Audio couldn't play. Try Play reply.", retry: "audio" });
      };
      await player.play();
      if (token === revision && player) update({ phase: "speaking", error: null, retry: null });
    } catch (error) {
      if (token !== revision) return;
      releaseAudio();
      update({ phase: "idle", error: error instanceof Error && error.name === "NotAllowedError"
        ? "Your browser paused audio. Click Play reply to hear the interviewer."
        : errorMessage(error), retry: "audio" });
    }
  }

  async function run(turn: Turn) {
    const token = ++revision;
    abort = new AbortController();
    const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(90_000)]);
    update({ phase: "thinking", error: null, retry: null });
    try {
      const response = await jsonRequest("/api/interviewer", turn.payload, signal);
      if (!response.ok) throw await errorResponse(response);
      const data = await response.json();
      if (!data.ok || typeof data.reply !== "string" || !data.reply.trim()) throw new Error(data.reason || "The interviewer returned no reply.");
      if (token !== revision) return false;
      options.append({ role: "interviewer", text: data.reply });
      pending = undefined;
      lastReply = data.reply;
      lastVoice = turn.voiceId;
      await speak(token, signal);
      return token === revision;
    } catch (error) {
      if (token === revision) update({ phase: "idle", error: errorMessage(error), retry: "turn" });
      return false;
    }
  }

  return {
    stop, dispose,
    async send(text: string) {
      const session = options.getSession();
      if (!session || session.endedAt || state.phase !== "idle" || !text.trim()) return false;
      // Snapshot history BEFORE appending this turn, including the current editor code.
      const turn: Turn = { voiceId: session.config.voiceId, payload: {
        transcript: text.trim(), problem: session.problem, code: session.code,
        history: session.transcript.slice(-40), tone: session.config.tone, language: session.config.language,
      } };
      cachedAudio = undefined;
      pending = turn;
      options.append({ role: "candidate", text: text.trim() });
      return run(turn);
    },
    async retry() {
      if (state.phase !== "idle") return;
      if (state.retry === "turn" && pending) await run(pending);
      else if (state.retry === "audio" && lastReply) {
        const token = ++revision;
        abort = new AbortController();
        await speak(token, AbortSignal.any([abort.signal, AbortSignal.timeout(60_000)]));
      }
    },
  };
}
