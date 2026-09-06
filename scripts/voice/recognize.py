"""Independent Arabic ASR smoke test; no expected-text hints are given to Whisper.

This checks speech intelligibility, not native Palestinian pronunciation. The
report includes every clip and binds results to the exact WAV file hashes.
"""
import hashlib
import json
from importlib.metadata import version
from pathlib import Path

from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parents[2]


def main():
    model = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=4)
    manifest = json.loads((ROOT / "src/audioManifest.json").read_text())
    rows = []
    for phrase, filename in manifest["clips"].items():
        path = ROOT / "public" / filename
        segments, _ = model.transcribe(str(path), language="ar", beam_size=5,
                                       condition_on_previous_text=False)
        segments = list(segments)
        text = " ".join(s.text.strip() for s in segments).strip()
        rows.append({"phrase": phrase, "file": filename,
                     "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                     "transcript": text})
        print(f"{len(rows)}/81 {phrase} => {text!r}", flush=True)
    report = {"recognizer": "Systran/faster-whisper-small",
              "implementation": f"faster-whisper {version('faster-whisper')}",
              "language": "ar", "expectedTextPrompt": False, "clips": rows}
    (ROOT / "scripts/voice/recognition.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
