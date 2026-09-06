import { useCallback, useEffect, useRef, useState } from "react";
import { prepareRecording } from "./recordingAudio";

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
  const [level, setLevel] = useState(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [micName, setMicName] = useState("");
  const monitor = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
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
    analyser.current = null;
    if (monitor.current) void monitor.current.close().catch(() => {});
    monitor.current = null;
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
    setLevel(0);
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
    }
    // Let MediaRecorder flush its final audio before releasing input tracks.
    if (clock.current) clearInterval(clock.current);
    clock.current = null;
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
      // Resume inside the recording tap, before awaiting microphone permission.
      const context = new AudioContext();
      monitor.current = context;
      void context.resume().catch(() => {});
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          channelCount: { ideal: 1 },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
      if (request !== generation.current) {
        mic.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = mic;
      setMicName(mic.getAudioTracks()[0]?.label || "Selected microphone");
      void navigator.mediaDevices
        .enumerateDevices()
        .then((items) => {
          if (request === generation.current)
            setDevices(items.filter((item) => item.kind === "audioinput"));
        })
        .catch(() => {});
      const meter = context.createAnalyser();
      meter.fftSize = 2048;
      context.createMediaStreamSource(mic).connect(meter);
      // No connection to speakers: the meter must never echo the microphone.
      analyser.current = meter;
      const meterSamples = new Float32Array(meter.fftSize);
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
      current.onstop = async () => {
        if (request !== generation.current) return;
        if (finishTimer.current) clearTimeout(finishTimer.current);
        finishTimer.current = null;
        releaseMic();
        recorder.current = null;
        setLevel(0);
        setPhase("finishing");
        const duration = Math.min(
          MAX_RECORDING_SECONDS,
          (performance.now() - started.current) / 1000,
        );
        if (tooLarge || !bytes || duration < 0.4) {
          setPhase("idle");
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
        finishTimer.current = setTimeout(() => {
          cancelWork();
          setPhase("idle");
          setError("The recording couldn’t be checked. Please try again.");
        }, 10000);
        try {
          const prepared = await prepareRecording(
            new Blob(chunks, { type: current.mimeType || mime }),
          );
          if (request !== generation.current) return;
          const url = URL.createObjectURL(prepared.blob);
          objectUrl.current = url;
          setTake({ ...prepared, url });
        } catch (cause) {
          if (request !== generation.current) return;
          setError(
            cause instanceof Error
              ? cause.message
              : "The recording couldn’t be checked. Please try again.",
          );
        } finally {
          if (request === generation.current) {
            if (finishTimer.current) clearTimeout(finishTimer.current);
            finishTimer.current = null;
            setPhase("idle");
          }
        }
      };
      started.current = performance.now();
      current.start(250);
      setPhase("recording");
      clock.current = setInterval(() => {
        analyser.current?.getFloatTimeDomainData(meterSamples);
        const rms = Math.sqrt(
          meterSamples.reduce((sum, value) => sum + value * value, 0) /
            meterSamples.length,
        );
        setLevel(Math.min(1, rms * 8));
        const elapsed = (performance.now() - started.current) / 1000;
        setSeconds(Math.min(MAX_RECORDING_SECONDS, Math.floor(elapsed)));
        if (elapsed >= MAX_RECORDING_SECONDS) stop();
      }, 100);
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
  }, [clear, supported, beforeRecord, stop, cancelWork, releaseMic, deviceId]);
  return {
    phase,
    take,
    seconds,
    error,
    supported,
    start,
    stop,
    clear,
    level,
    devices,
    deviceId,
    setDeviceId,
    micName,
  };
}
