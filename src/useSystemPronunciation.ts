import { useCallback, useEffect, useRef, useState } from "react";
import type { Phrase } from "./data";

// Keep the utterance alive until completion, and invalidate all work from an
// earlier tap before starting another. Some browsers load voices asynchronously.
export function useSystemPronunciation(
  enabled: boolean,
  notify: (message: string) => void,
) {
  const [speaking, setSpeaking] = useState<string | null>(null);
  const active = useRef<SpeechSynthesisUtterance | null>(null);
  const generation = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const waiting = useRef<(() => void) | null>(null);
  const voices = useRef<SpeechSynthesisVoice[]>([]);
  const clearWork = useCallback(() => {
    generation.current++;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    waiting.current = null;
    if (active.current) {
      active.current.onend = null;
      active.current.onerror = null;
      active.current.onstart = null;
      active.current = null;
    }
  }, []);
  const stop = useCallback(() => {
    const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
    const needsCancel = !!active.current || synth?.speaking || synth?.pending;
    clearWork();
    if (needsCancel) synth?.cancel();
    setSpeaking(null);
  }, [clearWork]);

  useEffect(() => {
    if (!window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    const refresh = () => {
      voices.current = synth.getVoices();
      waiting.current?.();
    };
    refresh();
    synth.addEventListener("voiceschanged", refresh);
    return () => {
      synth.removeEventListener("voiceschanged", refresh);
      clearWork();
      synth.cancel();
    };
  }, [clearWork]);
  useEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);

  const speak = useCallback(
    (phrase: Phrase) => {
      if (!enabled) {
        notify("Audio is off. You can turn it on in Settings.");
        return;
      }
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
        notify(
          "This browser doesn’t support spoken audio. The pronunciation guide is always available.",
        );
        return;
      }
      const synth = window.speechSynthesis;
      const replacing = !!active.current || synth.speaking || synth.pending;
      stop();
      const request = generation.current;
      setSpeaking(phrase.ar);
      let started = false;
      const arabicVoice = () => {
        const available = synth.getVoices();
        if (available.length) voices.current = available;
        const arabic = voices.current.filter((v) =>
          /^ar(?:[-_]|$)/i.test(v.lang),
        );
        return (
          arabic.find((v) => /^ar[-_](PS|JO|LB|SY)$/i.test(v.lang)) ||
          arabic.find((v) => v.localService) ||
          arabic[0]
        );
      };
      const play = () => {
        if (request !== generation.current || started) return;
        const voice = arabicVoice();
        if (!voice) return;
        started = true;
        waiting.current = null;
        const utterance = new SpeechSynthesisUtterance(phrase.ar);
        active.current = utterance;
        utterance.voice = voice;
        utterance.lang = voice.lang;
        utterance.rate = 0.8;
        const finish = (message?: string) => {
          if (request !== generation.current) return;
          stop();
          if (message) notify(message);
        };
        utterance.onend = () => finish();
        utterance.onerror = (event) =>
          finish(
            event.error === "canceled" || event.error === "interrupted"
              ? undefined
              : event.error === "not-allowed"
                ? "Your browser blocked audio. Tap the speaker again to retry."
                : "Audio couldn’t play. Tap the speaker to retry, or use the pronunciation guide.",
          );
        const start = () => {
          if (request !== generation.current) return;
          try {
            // cancel() does not reset the global paused state.
            synth.resume();
            synth.speak(utterance);
            synth.resume();
            timers.current.push(
              setTimeout(
                () => finish("Audio stalled. Tap the speaker to try again."),
                20000,
              ),
            );
          } catch {
            finish("Audio couldn’t start. Tap the speaker to retry.");
          }
        };
        // Allow the previous cancellation to settle before queuing a replacement.
        // The first/finished playback stays inside the user's click handler.
        if (replacing) timers.current.push(setTimeout(start, 80));
        else start();
      };
      play();
      if (!started) {
        waiting.current = play;
        timers.current.push(setTimeout(play, 250));
        timers.current.push(
          setTimeout(() => {
            if (request !== generation.current || started) return;
            play();
            if (!started) {
              stop();
              notify(
                "No Arabic voice is available yet. Enable an Arabic voice in your device’s speech settings, then tap again.",
              );
            }
          }, 2000),
        );
      }
    },
    [enabled, notify, stop],
  );
  return { speak, stop, speaking };
}
