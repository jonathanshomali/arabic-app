import { useEffect, useRef, useState } from "react";
import { Mic, Square, Upload, RotateCcw, Download } from "lucide-react";
import type { Phrase } from "./data";
import { supabase } from "./supabase";
import { useRecorder } from "./useRecorder";
import {
  CONTRIBUTION_MODE,
  RECORDING_NOTICE,
  uploadContribution,
} from "./voiceContributions";

export function PhraseRecorder({
  phrase,
  lessonId,
  userId,
  stopAudio,
  onSignIn,
  onBusyChange,
}: {
  phrase: Phrase;
  lessonId: number;
  userId?: string;
  stopAudio: () => void;
  onSignIn: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const recording = useRecorder(stopAudio);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(!!userId);
  const [upload, setUpload] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const [contribute, setContribute] = useState(CONTRIBUTION_MODE === "pilot");
  const attempt = useRef<{ blob: Blob; id: string } | null>(null);
  const mounted = useRef(true);
  const audio = useRef<HTMLAudioElement | null>(null);
  const busy = recording.phase !== "idle" || upload === "saving";
  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      audio.current?.pause();
    };
  }, []);
  useEffect(() => {
    let active = true;
    if (!supabase || !userId) {
      setChecking(false);
      return;
    }
    void supabase.rpc("voice_contributions_ready").then(({ data, error }) => {
      if (!active) return;
      setReady(!error && data === true);
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  async function submit() {
    const take = recording.take;
    if (!take || !userId || !ready) return;
    if (attempt.current?.blob !== take.blob)
      attempt.current = { blob: take.blob, id: crypto.randomUUID() };
    setUpload("saving");
    setMessage("");
    try {
      await uploadContribution(attempt.current.id, phrase, lessonId, take);
      if (mounted.current) setUpload("saved");
    } catch (cause) {
      if (mounted.current) {
        setUpload("error");
        setMessage(
          cause instanceof Error
            ? cause.message
            : "The upload failed. Please try again.",
        );
      }
    }
  }
  useEffect(() => {
    if (
      recording.take &&
      contribute &&
      userId &&
      ready &&
      attempt.current?.blob !== recording.take.blob
    )
      void submit();
  }, [recording.take, contribute, userId, ready]);

  function start() {
    audio.current?.pause();
    setUpload("idle");
    setMessage("");
    void recording.start();
  }
  const mime = recording.take?.mime;
  const extension =
    mime === "audio/mp4"
      ? "m4a"
      : mime === "audio/ogg"
        ? "ogg"
        : mime === "audio/wav"
          ? "wav"
          : "webm";
  return (
    <section className="phrase-recorder" aria-label={`Record ${phrase.en}`}>
      <div className="recorder-heading">
        <Mic size={19} />
        <strong>Your turn to say it</strong>
        <span>20 sec max</span>
      </div>
      <p className="recording-notice">
        {CONTRIBUTION_MODE === "pilot"
          ? RECORDING_NOTICE
          : "Practice recordings stay on this page unless you choose to contribute a take for review and future speech-model training."}
      </p>
      {CONTRIBUTION_MODE === "optional" && (
        <label className="recording-consent">
          <input
            type="checkbox"
            checked={contribute}
            onChange={(e) => setContribute(e.target.checked)}
          />
          Contribute my own voice to Yalla’s speech-model training.
        </label>
      )}
      {!userId && contribute ? (
        <button className="secondary" type="button" onClick={onSignIn}>
          Sign in to record & contribute
        </button>
      ) : contribute && !ready ? (
        <p role="status">
          {checking
            ? "Checking recording availability…"
            : "Voice contributions aren’t ready yet. Please try again after the pilot setup is complete."}
        </p>
      ) : (
        <div className="recorder-buttons">
          {recording.phase === "recording" ? (
            <button
              className="record-stop"
              type="button"
              onClick={recording.stop}
            >
              <Square size={15} fill="currentColor" />
              Stop recording · {recording.seconds}s
            </button>
          ) : recording.phase === "requesting" ? (
            <button
              className="secondary"
              type="button"
              onClick={recording.clear}
            >
              Cancel microphone request
            </button>
          ) : (
            <button
              className="secondary"
              type="button"
              disabled={busy}
              onClick={start}
            >
              {recording.take ? <RotateCcw size={16} /> : <Mic size={16} />}
              {recording.phase === "finishing"
                ? "Finishing recording…"
                : recording.take
                  ? "Record another take"
                  : contribute
                    ? "Record & contribute"
                    : "Record my voice"}
            </button>
          )}
        </div>
      )}
      {recording.take && (
        <div className="recorded-take">
          <audio
            ref={audio}
            controls
            src={recording.take.url}
            aria-label={`Your recording of ${phrase.en}`}
            onPlay={stopAudio}
          />
          <a
            href={recording.take.url}
            download={`yalla-lesson-${lessonId + 1}.${extension}`}
          >
            <Download size={14} />
            Save a copy
          </a>
          {upload === "saving" && (
            <p role="status">Uploading your contribution…</p>
          )}
          {upload === "saved" && (
            <p className="recording-saved" role="status">
              Contributed! Your take is waiting for review. Manage or delete it
              in Settings.
            </p>
          )}
          {upload === "error" && (
            <div role="alert">
              <p>Your take hasn’t finished uploading. {message}</p>
              <button
                className="secondary"
                type="button"
                onClick={() => void submit()}
              >
                <Upload size={16} />
                Retry upload
              </button>
              <small>
                Keep this page open to retry, or save a copy. Incomplete
                submissions can be deleted in Settings.
              </small>
            </div>
          )}
        </div>
      )}
      {recording.error && <p role="alert">{recording.error}</p>}
    </section>
  );
}
