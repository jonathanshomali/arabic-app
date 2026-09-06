import { useCallback, useEffect, useRef, useState } from "react";

export type RecordedTake = {
  blob: Blob;
  url: string;
  seconds: number;
  mime: string;
};
export const MAX_RECORDING_SECONDS = 20;
const MAX_BYTES = 2 * 1024 * 1024;

export function useRecorder(beforeRecord: () => void) {
  const [phase, setPhase] = useState<
    "idle" | "requesting" | "recording" | "finishing"
  >("idle");
  const [take, setTake] = useState<RecordedTake | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const clock = useRef<ReturnType<typeof setInterval> | null>(null);
  const objectUrl = useRef<string | null>(null);
  const started = useRef(0);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supported =
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  const releaseMic = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (clock.current) clearInterval(clock.current);
    clock.current = null;
  }, []);
  const cancelWork = useCallback(() => {
    generation.current++;
    if (finishTimer.current) clearTimeout(finishTimer.current);
    finishTimer.current = null;
    const current = recorder.current;
    recorder.current = null;
    if (current) {
      current.ondataavailable = null;
      current.onstop = null;
      current.onerror = null;
      try {
        if (current.state !== "inactive") current.stop();
      } catch {
        /* Still release every track below. */
      }
    }
    releaseMic();
  }, [releaseMic]);
  const clear = useCallback(() => {
    cancelWork();
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    setTake(null);
    setPhase("idle");
    setSeconds(0);
    setError("");
  }, [cancelWork]);
  useEffect(
    () => () => {
      cancelWork();
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [cancelWork],
  );

  const stop = useCallback(() => {
    const current = recorder.current;
    if (!current || current.state === "inactive") return;
    setPhase("finishing");
    try {
      current.stop();
    } catch {
      cancelWork();
      setPhase("idle");
      setError("The recording couldn’t stop cleanly. Please try again.");
      return;
    } finally {
      releaseMic();
    }
    // Some engines can fail to emit the final data event after device removal.
    finishTimer.current = setTimeout(() => {
      cancelWork();
      setPhase("idle");
      setError("The recording couldn’t finish. Please try again.");
    }, 3000);
  }, [releaseMic, cancelWork]);

  useEffect(() => {
    const hidden = () => {
      if (document.hidden) clear();
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", clear);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", clear);
    };
  }, [clear]);

  const start = useCallback(async () => {
    clear();
    if (!supported) {
      setError(
        "Recording isn’t supported in this browser. Try a recent Safari, Chrome, or Firefox browser over HTTPS.",
      );
      return;
    }
    beforeRecord();
    setPhase("requesting");
    const request = generation.current;
    try {
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      if (request !== generation.current) {
        mic.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = mic;
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
        "audio/webm",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const current = new MediaRecorder(
        mic,
        mimeType ? { mimeType, audioBitsPerSecond: 128000 } : undefined,
      );
      recorder.current = current;
      const chunks: Blob[] = [];
      let bytes = 0;
      let tooLarge = false;
      current.ondataavailable = (event) => {
        if (request !== generation.current || !event.data.size) return;
        bytes += event.data.size;
        if (bytes > MAX_BYTES) {
          tooLarge = true;
          stop();
          return;
        }
        chunks.push(event.data);
      };
      current.onerror = () => {
        if (request !== generation.current) return;
        cancelWork();
        setPhase("idle");
        setError("The microphone stopped working. Please try recording again.");
      };
      current.onstop = () => {
        if (request !== generation.current) return;
        if (finishTimer.current) clearTimeout(finishTimer.current);
        finishTimer.current = null;
        releaseMic();
        recorder.current = null;
        setPhase("idle");
        const duration = Math.min(
          MAX_RECORDING_SECONDS,
          (performance.now() - started.current) / 1000,
        );
        if (tooLarge || !bytes || duration < 0.4) {
          setError(
            tooLarge
              ? "This recording is too large. Try a shorter take."
              : "Try a slightly longer recording so we can hear the phrase.",
          );
          return;
        }
        const mime = (
          current.mimeType ||
          chunks[0]?.type ||
          "audio/webm"
        ).split(";")[0];
        const blob = new Blob(chunks, { type: current.mimeType || mime });
        const url = URL.createObjectURL(blob);
        objectUrl.current = url;
        setTake({ blob, url, seconds: duration, mime });
      };
      started.current = performance.now();
      current.start(250);
      setPhase("recording");
      clock.current = setInterval(() => {
        const elapsed = (performance.now() - started.current) / 1000;
        setSeconds(Math.min(MAX_RECORDING_SECONDS, Math.floor(elapsed)));
        if (elapsed >= MAX_RECORDING_SECONDS) stop();
      }, 200);
    } catch (cause) {
      if (request !== generation.current) return;
      cancelWork();
      setPhase("idle");
      setError(
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Microphone access was denied. Allow it in your browser’s site settings, then try again."
          : "We couldn’t open your microphone. Check that it’s connected and not in use, then try again.",
      );
    }
  }, [clear, supported, beforeRecord, stop, cancelWork, releaseMic]);
  return { phase, take, seconds, error, supported, start, stop, clear };
}
