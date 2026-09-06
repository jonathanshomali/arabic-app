"""Independent Arabic ASR smoke test; no expected-text hints are given to Whisper.

This checks speech intelligibility, not native Palestinian pronunciation. The
report includes every clip and binds results to the exact WAV file hashes.
"""
import hashlib
import argparse
import json
from importlib.metadata import version
from pathlib import Path

from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--phrase", action="append", help="Recognize only changed Arabic phrases; repeat as needed")
    args = parser.parse_args()
    model = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=4)
    manifest = json.loads((ROOT / "src/audioManifest.json").read_text())
    selected = set(args.phrase or manifest["clips"])
    if not selected <= set(manifest["clips"]):
        raise ValueError(f"Unknown phrases: {selected - set(manifest['clips'])}")
    report_path = ROOT / "scripts/voice/recognition.json"
    previous = {row["phrase"]: row for row in json.loads(report_path.read_text())["clips"]} if args.phrase else {}
    rows = []
    for phrase, filename in manifest["clips"].items():
        path = ROOT / "public" / filename
        if phrase not in selected:
            row = previous[phrase]
            if row["file"] != filename or row["sha256"] != hashlib.sha256(path.read_bytes()).hexdigest():
                raise ValueError(f"Unselected clip has stale recognition: {phrase}")
            rows.append(row)
            continue
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
