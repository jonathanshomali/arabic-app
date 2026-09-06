import assert from "node:assert/strict";

export function checkSignal(wav) {
  const length = wav.readUInt32LE(40);
  assert.equal(length + 44, wav.length);
  let energy = 0;
  let differenceEnergy = 0;
  let peak = 0;
  let previous = 0;
  for (let offset = 44; offset < wav.length; offset += 2) {
    const sample = wav.readInt16LE(offset) / 32768;
    energy += sample ** 2;
    if (offset > 44) differenceEnergy += (sample - previous) ** 2;
    previous = sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  const rms = Math.sqrt(energy / (length / 2));
  const differenceRatio = differenceEnergy / energy;
  assert.ok(rms > 0.002, "Non-silent signal");
  assert.ok(peak < 0.999, "No clipped PCM peaks");
  // The broken vocoder produced a ratio around 2.58; this corrected pack is <1.24.
  // This is a regression guard for broadband static, not a pronunciation score.
  assert.ok(
    differenceRatio < 1.8,
    `Suspicious static/noise signal (${differenceRatio.toFixed(3)})`,
  );
  return { rms, peak, differenceRatio };
}
