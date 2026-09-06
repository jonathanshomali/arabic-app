"""Build the experimental Yalla audio pack locally; no API credentials required.

Uses an existing Palestinian model, not a newly trained voice. The explicit
phoneme inputs are editable teaching approximations and need native review.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from huggingface_hub import hf_hub_download
from model_loader import load_model

MODEL_ID = "hamdallah/Sofelia-TTS-82M"
REVISION = "e1b729a4641311df2d78a22d81c42c10bfda64db"
ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
RATE = 24000
HASHES = {
    "config.json": "5abb01e2403b072bf03d04fde160443e209d7a0dad49a423be15196b9b43c17f",
    "voices/eliaa.pt": "6c37b9d77b5b7439cabe50e60417cc590c2190b0859933ebf2daa60ee9a94546",
    "kokoro_sofelia_82M.pth": "4f42a38e0e2448bc16a3ace479b25d8c616a30dbb6c0f34534d3a06c3a559b97",
}
# Token remapping documented by the model's Palestinian frontend.
REMAP = str.maketrans({"ħ": "ʰ", "ʕ": "ʁ", "ˤ": "ᵊ"})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-dir", type=Path, help="Use already downloaded pinned model files")
    parser.add_argument("--phrase", action="append", help="Regenerate only this Arabic phrase; repeat for multiple corrections")
    args = parser.parse_args()

    phrases = json.loads((HERE / "phrases.json").read_text())
    pronunciations = json.loads((HERE / "pronunciations.json").read_text())
    settings = json.loads((HERE / "synthesis-settings.json").read_text())
    if set(p["ar"] for p in phrases) != set(pronunciations):
        raise ValueError("Curriculum and pronunciation coverage differ. Run voice:export and update pronunciations.json.")
    selected = set(args.phrase or pronunciations)
    if not selected <= set(pronunciations):
        raise ValueError(f"Unknown phrases: {selected - set(pronunciations)}")
    if not set(settings) <= set(pronunciations):
        raise ValueError("Synthesis settings contain unknown phrases")
    previous_manifest = json.loads((ROOT / "src/audioManifest.json").read_text()) if args.phrase else None
    previous_review = {row["ar"]: row for row in json.loads((HERE / "review.json").read_text())} if args.phrase else {}

    def model_file(name):
        if args.model_dir:
            path = args.model_dir / name
        else:
            path = Path(hf_hub_download(MODEL_ID, name, revision=REVISION))
        if hashlib.sha256(path.read_bytes()).hexdigest() != HASHES[name]:
            raise ValueError(f"Checkpoint integrity mismatch: {name}")
        return str(path)

    torch.set_num_threads(4)
    torch.manual_seed(42)
    model = load_model(model_file("config.json"), model_file("kokoro_sofelia_82M.pth"))
    voice = torch.load(model_file("voices/eliaa.pt"), map_location="cpu", weights_only=True)
    out = ROOT / "public/audio/yalla-v1"
    out.mkdir(parents=True, exist_ok=True)
    clips = {}
    details = []
    for phrase in phrases:
        if phrase["ar"] not in selected:
            clips[phrase["ar"]] = previous_manifest["clips"][phrase["ar"]]
            details.append(previous_review[phrase["ar"]])
            continue
        ps = pronunciations[phrase["ar"]].translate(REMAP)
        unknown = set(ps) - set(model.vocab)
        if unknown or not 1 <= len(ps) <= 500:
            raise ValueError(f"Unsupported phonemes for {phrase['ar']}: {unknown}")
        options = settings.get(phrase["ar"], {})
        speed = options.get("speed", 0.9)
        if not 0.5 <= speed <= 2:
            raise ValueError(f"Invalid speed for {phrase['ar']}")
        if "seed" in options:
            torch.manual_seed(options["seed"])
        with torch.inference_mode():
            samples = model(ps, voice[len(ps) - 1], speed).numpy().squeeze()
        duration = len(samples) / RATE
        peak = float(np.abs(samples).max())
        rms = float(np.sqrt(np.mean(samples ** 2)))
        if not np.isfinite(samples).all() or not 0.25 <= duration <= 15 or rms < 0.002:
            raise ValueError(f"Invalid/silent audio for {phrase['ar']}")
        difference_ratio = float(np.sum(np.diff(samples) ** 2) / np.sum(samples ** 2))
        if difference_ratio >= 1.8:
            raise ValueError(f"Static/noise detected for {phrase['ar']}: {difference_ratio:.3f}")
        # Preserve natural dynamics; only attenuate peaks that would clip PCM.
        samples = samples * min(1.0, 0.95 / max(peak, 0.001))
        # A short trailing pad prevents final consonants being lost at playback end.
        samples = np.pad(samples, (0, int(RATE * 0.12)))
        digest = hashlib.sha256(samples.tobytes()).hexdigest()[:16]
        filename = f"{digest}.wav"
        sf.write(out / filename, samples, RATE, subtype="PCM_16")
        clips[phrase["ar"]] = f"audio/yalla-v1/{filename}"
        details.append({**phrase, "phonemes": pronunciations[phrase["ar"]],
                        "file": filename, "seconds": round(len(samples) / RATE, 3),
                        "rms": round(rms, 5), "nativeReviewed": False, **options})
        print(f"{len(details)}/{len(phrases)} {phrase['ar']} ({duration:.2f}s)", flush=True)
    manifest = {"model": MODEL_ID, "revision": REVISION, "voice": "Eliaa",
                "status": "experimental", "sampleRate": RATE, "clips": clips}
    (ROOT / "src/audioManifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    (HERE / "review.json").write_text(json.dumps(details, ensure_ascii=False, indent=2) + "\n")
    # Delete only obsolete generated wav files in this pack after successful generation.
    keep = {d["file"] for d in details}
    for path in out.glob("*.wav"):
        if path.name not in keep:
            path.unlink()


if __name__ == "__main__":
    main()
