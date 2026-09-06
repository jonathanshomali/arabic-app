import { useState } from "react";
import { ArrowRight, Volume2 } from "lucide-react";
import { Mascot } from "./Mascot";
import { Modal } from "./Modal";
import { lessons } from "./data";
import { usePronunciation, type VoiceChoice } from "./usePronunciation";

const WELCOME_KEY = "yalla-welcome-seen-v1";

export function needsWelcome() {
  try {
    return localStorage.getItem(WELCOME_KEY) !== "yes";
  } catch {
    return true;
  }
}

export function rememberWelcome() {
  try {
    localStorage.setItem(WELCOME_KEY, "yes");
  } catch {
    // Dismissal still works for this visit when browser storage is unavailable.
  }
}

export function WelcomeModal({
  onClose,
  voice,
  sound,
}: {
  onClose: () => void;
  voice: VoiceChoice;
  sound: boolean;
}) {
  const [message, setMessage] = useState("");
  const { speak, speaking } = usePronunciation(sound, setMessage, voice);
  const hello = lessons[0].phrases[0];
  return (
    <Modal
      title="Meet Zaytoun"
      onClose={onClose}
      className="welcome-modal"
      descriptionId="zaytoun-introduction"
    >
      <div className="welcome-content">
        <div className="welcome-mascot-scene">
          <span className="welcome-arabic" lang="ar" dir="rtl">
            أهلين!
          </span>
          <Mascot className="welcome-mascot" happy />
          <span className="welcome-voice-badge">
            A little bird. A growing voice.
          </span>
        </div>
        <div className="welcome-speech" id="zaytoun-introduction">
          <span className="eyebrow">YOUR PALESTINIAN ARABIC COMPANION</span>
          <h3>Marhaba! I’m Zaytoun.</h3>
          <p>
            I’m your friendly olive bird, here to cheer you on through every new
            word and little win.
          </p>
          <h4>I’m still finding my voice!</h4>
          <p>
            My Levantine Arabic AI voice is an experimental feature. Think of me
            as your guide in training: my pronunciation still needs practice,
            testing, and refinement.
          </p>
          <p>
            We’ll keep improving it as we go. Thanks for growing with me, one
            word at a time!
          </p>
        </div>
        <div className="welcome-actions">
          <button
            type="button"
            className="secondary"
            aria-pressed={speaking === hello.ar}
            onClick={() => {
              setMessage("");
              speak(hello);
            }}
          >
            <Volume2 size={18} /> Hear my hello
          </button>
          <button type="button" className="primary" onClick={onClose}>
            Yalla, let’s learn! <ArrowRight size={18} />
          </button>
        </div>
        {message && (
          <p className="welcome-message" role="status">
            {message}
          </p>
        )}
        <p className="welcome-footnote">
          You can change your learning voice or turn audio off in Settings.
        </p>
      </div>
    </Modal>
  );
}
