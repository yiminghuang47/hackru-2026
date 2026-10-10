"use client";

import { useEffect, useState } from "react";
import type { Tone, TranscriptEntry } from "@/lib/types";
import { VOICES } from "@/lib/voices";
import { VoiceOrb } from "@/components/VoiceOrb";
import { VadIndicator } from "@/components/VadIndicator";

// Rough speaking time for a line until real TTS playback drives this (milestone 3).
const MS_PER_CHAR = 55;
const MIN_SPEAK_MS = 1500;
const MAX_SPEAK_MS = 12000;

/**
 * True while the interviewer's newest line is "being said". Lines that were
 * already in the transcript when the page loaded don't replay.
 */
function useInterviewerSpeaking(transcript: TranscriptEntry[], startedAt: number) {
  const [speakingIndex, setSpeakingIndex] = useState(-1);
  const lastIndex = transcript.length - 1;
  const last = transcript[lastIndex];

  useEffect(() => {
    if (!last || last.role !== "interviewer") return;
    const duration = Math.min(MAX_SPEAK_MS, Math.max(MIN_SPEAK_MS, last.text.length * MS_PER_CHAR));
    const remaining = duration - (Date.now() - (startedAt + last.at));
    if (remaining <= 0) return;
    const on = setTimeout(() => setSpeakingIndex(lastIndex), 0);
    const off = setTimeout(() => setSpeakingIndex(-1), remaining);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, [last, lastIndex, startedAt]);

  return speakingIndex === lastIndex && lastIndex >= 0;
}

/** The interviewer's side of the call: the voice orb, who they are, and what the mic is doing. */
export function InterviewerPanel({
  voiceId,
  tone,
  transcript,
  startedAt,
}: {
  voiceId: string;
  tone: Tone;
  transcript: TranscriptEntry[];
  startedAt: number;
}) {
  const speaking = useInterviewerSpeaking(transcript, startedAt);
  const name = VOICES.find((v) => v.id === voiceId)?.name ?? "Interviewer";

  return (
    <div className="interviewer-pop flex flex-col items-center px-4 pb-4 pt-2">
      <VoiceOrb speaking={speaking} size={200} />
      <p className="-mt-2 font-medium text-zinc-100">{name}</p>
      <p className="text-xs text-zinc-500">{tone} interviewer</p>
      <div className="mt-3">
        {/* The mic is always on with VAD. Wired up in milestone 3. */}
        <VadIndicator state={speaking ? "interviewer" : "idle"} />
      </div>
    </div>
  );
}
