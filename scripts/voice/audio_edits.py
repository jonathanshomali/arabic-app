"""Small, reproducible edits that preserve approved portions of synthetic clips."""
import hashlib
from pathlib import Path

import numpy as np
import soundfile as sf


def shape_vowel(samples, rate, edit):
    """Reshape only a vowel's spectral envelope, keeping its pitch contour."""
    import pyworld as pw

    start, end, fade = edit["start"], edit["end"], edit["fade"]
    source = np.asarray(edit["sourceHz"], dtype=float)
    target = np.asarray(edit["targetHz"], dtype=float)
    if (not 0 <= start < end <= len(samples) / rate or not 0 < fade <= (end - start) / 2
            or source.shape != target.shape or source.ndim != 1
            or source[0] != 0 or target[0] != 0 or source[-1] != rate / 2
            or target[-1] != rate / 2 or not (np.diff(source) > 0).all()
            or not (np.diff(target) > 0).all()):
        raise ValueError("Invalid vowel resonance settings")
    x = np.ascontiguousarray(samples, dtype=np.float64)
    pitch, times = pw.dio(x, rate, f0_floor=75, f0_ceil=600)
    pitch = pw.stonemask(x, pitch, times, rate)
    spectrum = pw.cheaptrick(x, pitch, times, rate)
    noise = pw.d4c(x, pitch, times, rate)
    frequencies = np.linspace(0, rate / 2, spectrum.shape[1])
    positions = np.interp(frequencies, target, source)
    for i, time in enumerate(times):
        strength = min(1, max(0, (time - start) / fade), max(0, (end - time) / fade))
        if strength:
            envelope = np.log(np.maximum(spectrum[i], 1e-12))
            shifted = np.interp(positions, frequencies, envelope)
            spectrum[i] = np.exp(envelope * (1 - strength) + shifted * strength)
    result = pw.synthesize(pitch, spectrum, noise, rate)[:len(samples)]
    if len(result) != len(samples) or not np.isfinite(result).all():
        raise ValueError("Invalid vowel resynthesis")
    result *= min(1.0, 0.9 / max(float(np.abs(result).max()), 0.001))
    return result.astype(np.float32)


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
