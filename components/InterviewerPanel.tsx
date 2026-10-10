"use client";

import type { Tone } from "@/lib/types";
import { VOICES } from "@/lib/voices";
import { VoiceOrb } from "@/components/VoiceOrb";
import { MicButton, type MicState } from "@/components/MicButton";
import { MicLevel } from "@/components/MicLevel";

/** The interviewer's side of the call: the voice orb, who they are, and what the mic is doing. */
export function InterviewerPanel({
  voiceId,
  tone,
  speaking,
  mic,
}: {
  voiceId: string;
  tone: Tone;
  speaking: boolean;
  mic: { state: MicState; error: string | null; stream: MediaStream | null; onClick?: () => void };
}) {
  const name = VOICES.find((v) => v.id === voiceId)?.name ?? "Interviewer";

  return (
    <div className="interviewer-pop flex flex-col items-center px-4 pb-4 pt-2">
      <VoiceOrb speaking={speaking} size={200} />
      <p className="-mt-2 font-medium text-zinc-100">{name}</p>
      <p className="text-xs text-zinc-500">{tone} interviewer</p>
      <div className="mt-3 w-full">
        {/* Click-to-talk mic. Clicking while the interviewer talks starts the candidate's turn. */}
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <MicButton state={mic.state === "idle" && speaking ? "interviewer" : mic.state} onClick={mic.onClick} />
          </div>
          <MicLevel stream={mic.stream} />
        </div>
        {mic.error && <p className="mt-2 text-xs text-red-400">{mic.error}</p>}
      </div>
    </div>
  );
}
