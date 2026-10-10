"use client";

import { useEffect, useRef, useState } from "react";

type Status = "starting" | "on" | "off" | "blocked";

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

async function acquire(): Promise<MediaStream | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, aspectRatio: 16 / 9, facingMode: "user" },
      audio: false,
    });
  } catch {
    return null;
  }
}

/**
 * The candidate's own webcam, mirrored like a video call. It is a local preview
 * only: nothing is recorded or sent anywhere.
 */
export function CameraPreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status>("starting");

  function attach(stream: MediaStream | null) {
    streamRef.current = stream;
    if (videoRef.current) videoRef.current.srcObject = stream;
    setStatus(stream ? "on" : "blocked");
  }

  useEffect(() => {
    let cancelled = false;
    acquire().then((stream) => {
      // The effect can be torn down before the permission prompt is answered.
      if (cancelled) stopStream(stream);
      else attach(stream);
    });
    return () => {
      cancelled = true;
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, []);

  function turnOff() {
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("off");
  }

  function turnOn() {
    setStatus("starting");
    acquire().then(attach);
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        aria-label="Your camera"
        className={`h-full w-full -scale-x-100 object-cover ${status === "on" ? "" : "invisible"}`}
      />

      {status !== "on" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
          <p className="text-sm text-zinc-400">
            {status === "starting" && "Starting camera…"}
            {status === "off" && "Camera is off"}
            {status === "blocked" && "Camera unavailable. Allow access in your browser to see yourself."}
          </p>
          {status !== "starting" && (
            <button
              type="button"
              onClick={turnOn}
              className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:border-zinc-500"
            >
              {status === "blocked" ? "Try again" : "Turn on camera"}
            </button>
          )}
        </div>
      )}

      <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-zinc-200">
        You
      </span>
      {status === "on" && (
        <button
          type="button"
          onClick={turnOff}
          className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-xs text-zinc-200 hover:bg-black/80"
        >
          Turn off
        </button>
      )}
    </div>
  );
}
