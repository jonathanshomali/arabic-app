"""Small, reproducible edits that preserve approved portions of synthetic clips."""
import hashlib
from pathlib import Path

import numpy as np
import soundfile as sf


def preserve_tail(samples, rate, edit, base):
    source = Path(base) / edit["file"]
    if hashlib.sha256(source.read_bytes()).hexdigest() != edit["sha256"]:
        raise ValueError("Preserved audio source hash mismatch")
    original, original_rate = sf.read(source, dtype="float32")
    if original_rate != rate or original.ndim != 1 or samples.ndim != 1:
        raise ValueError("Preserved audio must be mono and match the sample rate")
    start = round(edit["originalStart"] * rate)
    end = round(edit["generatedEnd"] * rate)
    overlap = round(edit["crossfade"] * rate)
    if not (0 <= start < len(original) and 0 < overlap <= end <= len(samples)
            and start + overlap < len(original)):
        raise ValueError("Invalid preserved audio edit boundaries")
    # Crossfade within the first word's /l/. Everything after it, including
    # the entire ma'ak portion, is copied exactly from the original PCM.
    fade = np.linspace(0, 1, overlap, dtype=np.float32)
    transition = samples[end - overlap:end] * (1 - fade) + original[start:start + overlap] * fade
    return np.concatenate((samples[:end - overlap], transition, original[start + overlap:]))
