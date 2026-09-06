// Decode the finished container before accepting a contribution. A nonempty
// MediaRecorder blob can contain nothing but silence.
export async function prepareRecording(blob: Blob) {
  const decoder = new OfflineAudioContext(1, 1, 24000);
  let decoded: AudioBuffer;
  try {
    decoded = await decoder.decodeAudioData(await blob.arrayBuffer());
  } catch {
    throw new Error(
      "This recording couldn’t be read. Please record another take.",
    );
  }
  if (decoded.duration < 0.4)
    throw new Error(
      "Try a slightly longer recording so we can hear the phrase.",
    );
  if (decoded.duration > 21)
    throw new Error("This recording is too long. Please try a shorter take.");

  // Select the strongest channel; averaging opposing stereo channels can
  // cancel a voice. Remove DC offset before measuring and normalizing.
  let samples = new Float32Array(decoded.length);
  let bestEnergy = 0;
  for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
    const input = decoded.getChannelData(channel);
    const mean = input.reduce((sum, value) => sum + value, 0) / input.length;
    const centered = Float32Array.from(input, (value) => value - mean);
    const energy = centered.reduce((sum, value) => sum + value * value, 0);
    if (energy > bestEnergy) {
      samples = centered;
      bestEnergy = energy;
    }
  }
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  const rms = Math.sqrt(bestEnergy / samples.length);
  if (!Number.isFinite(rms) || peak < 0.001 || rms < 0.0002)
    throw new Error(
      "We couldn’t hear sound from your microphone. Check that it isn’t muted, choose the right microphone, and try again. This take wasn’t uploaded.",
    );

  // Portable PCM playback, with a bounded boost for quiet microphones.
  // At 24 kHz, even a full 20-second take fits the private bucket's 2 MiB limit.
  const gain = Math.min(12, 0.8 / peak);
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(bytes);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++)
      view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, decoded.sampleRate, true);
  view.setUint32(28, decoded.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) =>
    view.setInt16(44 + i * 2, Math.round(sample * gain * 32767), true),
  );
  return {
    blob: new Blob([bytes], { type: "audio/wav" }),
    seconds: decoded.duration,
    mime: "audio/wav",
  };
}
