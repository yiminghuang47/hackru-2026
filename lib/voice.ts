"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MicState } from "@/components/MicButton";
import type { SttResponse } from "./types";

// Shorter recordings are treated as accidental double-clicks and dropped.
const MIN_RECORDING_MS = 300;

// Chrome/Firefox record webm, Safari records mp4. Scribe accepts either.
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

function pickMimeType() {
  return MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

function extensionFor(mimeType: string) {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

function micErrorMessage(err: unknown) {
  if (err instanceof DOMException && err.name === "NotAllowedError") {
    return "Mic access is blocked. Allow the microphone in your browser's address bar, then try again.";
  }
  if (err instanceof DOMException && err.name === "NotFoundError") {
    return "No microphone found.";
  }
  return "Couldn't start the microphone.";
}

/**
 * Click-to-talk mic. The first `toggleRecording()` starts recording, the second stops it,
 * sends the audio to `/api/stt` and calls `onUtterance` with the transcribed text.
 * The mic is released between turns.
 */
export function useVoice({ onUtterance }: { onUtterance: (text: string) => void }) {
  const [state, setState] = useState<MicState>("idle");
  const [error, setError] = useState<string | null>(null);
  // The live mic stream while recording, for the level meter. Null between turns.
  const [stream, setStream] = useState<MediaStream | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const startedAtRef = useRef(0);
  // Guards against a second click landing while getUserMedia is still resolving.
  const startingRef = useRef(false);

  // Keep the latest callback without re-creating toggleRecording on every render.
  const onUtteranceRef = useRef(onUtterance);
  useEffect(() => {
    onUtteranceRef.current = onUtterance;
  }, [onUtterance]);

  const transcribe = useCallback(async (audio: Blob) => {
    setState("thinking");
    try {
      const form = new FormData();
      form.append("audio", audio, `turn.${extensionFor(audio.type)}`);
      const res = await fetch("/api/stt", { method: "POST", body: form });
      const data = (await res.json()) as SttResponse;
      if (!data.ok) {
        setError(data.reason);
      } else if (data.text) {
        onUtteranceRef.current(data.text);
      }
    } catch {
      setError("Couldn't reach the server to transcribe that. Try again.");
    } finally {
      setState("idle");
    }
  }, []);

  const start = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setStream(null);
        recorderRef.current = null;
        const duration = Date.now() - startedAtRef.current;
        const audio = new Blob(chunks, { type: recorder.mimeType || mimeType });
        if (duration < MIN_RECORDING_MS || audio.size === 0) {
          setState("idle");
          return;
        }
        void transcribe(audio);
      };

      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start();
      setStream(stream);
      setState("recording");
    } catch (err) {
      setError(micErrorMessage(err));
      setState("idle");
    } finally {
      startingRef.current = false;
    }
  }, [transcribe]);

  const toggleRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    } else if (state !== "thinking") {
      void start();
    }
  }, [start, state]);

  // Release the mic if the room unmounts mid-recording.
  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (!recorder) return;
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
      recorder.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { state, error, stream, toggleRecording };
}
