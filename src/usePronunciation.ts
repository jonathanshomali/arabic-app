import { useCallback, useEffect, useRef, useState } from "react";
import type { Phrase } from "./data";
import manifest from "./audioManifest.json";
import { useSystemPronunciation } from "./useSystemPronunciation";

export type VoiceChoice = "system" | "yalla";
export function loadVoiceChoice(): VoiceChoice {
  try {
    return localStorage.getItem("yalla-voice") === "system"
      ? "system"
      : "yalla";
  } catch {
    return "yalla";
  }
}

const clips: Record<string, string> = manifest.clips;

export function usePronunciation(
  enabled: boolean,
  notify: (message: string) => void,
  voice: VoiceChoice = "yalla",
) {
  const system = useSystemPronunciation(enabled, notify);
  const [clipSpeaking, setClipSpeaking] = useState<string | null>(null);
  const active = useRef<HTMLAudioElement | null>(null);
  const generation = useRef(0);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearClip = useCallback(() => {
    generation.current++;
    if (watchdog.current) clearTimeout(watchdog.current);
    watchdog.current = null;
    if (active.current) {
      const audio = active.current;
      active.current = null;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
  }, []);
  const stop = useCallback(() => {
    clearClip();
    system.stop();
    setClipSpeaking(null);
  }, [clearClip, system.stop]);

  useEffect(() => {
    stop();
  }, [enabled, voice, stop]);
  useEffect(() => clearClip, [clearClip]);

  const speak = useCallback(
    (phrase: Phrase) => {
      clearClip();
      setClipSpeaking(null);
      const path = clips[phrase.ar];
      if (!enabled || voice !== "yalla" || !path) {
        if (enabled && voice === "yalla" && !path) {
          notify(
            "This phrase uses your device’s Arabic voice while its Yalla clip is being prepared.",
          );
        }
        system.speak(phrase);
        return;
      }
      system.stop();
      const request = generation.current;
      const audio = new Audio(`${import.meta.env.BASE_URL}${path}`);
      active.current = audio;
      setClipSpeaking(phrase.ar);
      const failed = (error?: unknown) => {
        if (request !== generation.current) return;
        stop();
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          notify("Your browser blocked audio. Tap the speaker again to retry.");
          return;
        }
        notify(
          "The Yalla clip couldn’t load. Trying your device’s Arabic voice.",
        );
        system.speak(phrase);
      };
      audio.onended = () => {
        if (request === generation.current) stop();
      };
      audio.onerror = () => failed();
      watchdog.current = setTimeout(() => failed(), 20000);
      // Start synchronously in the tap handler for mobile autoplay policies.
      try {
        void audio.play().catch(failed);
      } catch (error) {
        failed(error);
      }
    },
    [enabled, voice, notify, stop, clearClip, system.speak, system.stop],
  );

  return { speak, stop, speaking: clipSpeaking || system.speaking };
}
