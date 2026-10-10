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
  const generationRef = useRef(0);
  const requestRef = useRef<AbortController | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const release = useCallback(() => {
    generationRef.current++;
    startingRef.current = false;
    requestRef.current?.abort();
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) {
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
      recorder.stream.getTracks().forEach((track) => track.stop());
    }
  }, []);
  const stop = useCallback(() => {
    release(); setStream(null); setState("idle"); setError(null);
  }, [release]);

  // Keep the latest callback without re-creating toggleRecording on every render.
  const onUtteranceRef = useRef(onUtterance);
  useEffect(() => {
    onUtteranceRef.current = onUtterance;
  }, [onUtterance]);

  const transcribe = useCallback(async (audio: Blob) => {
    setState("transcribing");
    const generation = generationRef.current;
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const form = new FormData();
      form.append("audio", audio, `turn.${extensionFor(audio.type)}`);
      const res = await fetch("/api/stt", { method: "POST", body: form,
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]),
      });
      const data = (await res.json()) as SttResponse;
      if (generation !== generationRef.current) return;
      if (!res.ok || !data.ok) {
        setError(!data.ok ? data.reason : "Transcription failed. Please try again.");
      } else if (data.text) {
        onUtteranceRef.current(data.text);
      } else {
        setError("No speech was detected. Try again or type your answer below.");
      }
    } catch {
      if (generation === generationRef.current) setError("Couldn't transcribe that. Try again or type your answer below.");
    } finally {
      if (generation === generationRef.current) { setState("idle"); requestRef.current = null; }
    }
  }, []);

  const start = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setError(null);
    setState("starting");
    const generation = ++generationRef.current;
    let acquired: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("This browser cannot record audio. Use Chrome or type your answer below.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      acquired = stream;
      if (generation !== generationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
        if (generation !== generationRef.current) return;
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
      recordingTimerRef.current = setTimeout(() => {
        if (recorder.state === "recording") { setState("transcribing"); recorder.stop(); }
      }, 60_000);
      setStream(stream);
      setState("recording");
    } catch (err) {
      acquired?.getTracks().forEach((track) => track.stop());
      if (generation === generationRef.current) {
        setError(err instanceof Error && !(err instanceof DOMException) ? err.message : micErrorMessage(err));
        setState("idle");
      }
    } finally {
      if (generation === generationRef.current) startingRef.current = false;
    }
  }, [transcribe]);

  const toggleRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      setState("transcribing");
      recorder.stop();
    } else if (state === "idle") {
      void start();
    }
  }, [start, state]);

  // Cancels transcription and handles permission prompts resolving after unmount.
  useEffect(() => release, [release]);

  return { state, error, stream, toggleRecording, stop };
}
