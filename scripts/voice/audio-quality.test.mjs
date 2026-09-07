import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { checkSignal } from "./audio-quality.mjs";

test("rejects the actual static clip that previously passed WAV validation", async () => {
  const wav = await readFile(
    new URL("./fixtures/broken-hello.wav", import.meta.url),
  );
  assert.throws(() => checkSignal(wav), /static\/noise/);
});

test("corrected hello passes the static regression check", async () => {
  const manifest = JSON.parse(await readFile("src/audioManifest.json", "utf8"));
  const wav = await readFile(`public/${manifest.clips["مرحبا"]}`);
  assert.ok(checkSignal(wav).differenceRatio < 1.8);
});

// This particular voiced join should remain periodic. The previous splice
// mixed mismatched pitches, dropping correlation to 0.825; the aligned join
// stays above 0.99. This detects that artifact, not general speech quality.
function checkAllahJoin(wav, end) {
  const rate = wav.readUInt32LE(24);
  for (let step = 0; step <= 4; step++) {
    const center = end - 0.02 + step * 0.005;
    const start = Math.round((center - 0.015) * rate);
    const stop = Math.round((center + 0.015) * rate);
    assert.ok(start >= 0 && 44 + stop * 2 <= wav.length);
    let best = 0;
    for (let lag = Math.round(rate / 400); lag < Math.round(rate / 200); lag++) {
      let product = 0;
      let firstEnergy = 0;
      let secondEnergy = 0;
      for (let i = start + lag; i < stop; i++) {
        const a = wav.readInt16LE(44 + i * 2);
        const b = wav.readInt16LE(44 + (i - lag) * 2);
        product += a * b;
        firstEnergy += a * a;
        secondEnergy += b * b;
      }
      best = Math.max(best, product / Math.sqrt(firstEnergy * secondEnergy));
    }
    assert.ok(best > 0.95, `Disrupted voicing at Allah join (${best.toFixed(3)})`);
  }
}

test("detects the reported voice crack in the previous Allah splice", async () => {
  const wav = await readFile(
    new URL("./fixtures/allah-maak-cracked.wav", import.meta.url),
  );
  assert.throws(() => checkAllahJoin(wav, 0.92), /Disrupted voicing/);
});

test("Allah join stays voiced and keeps the approved opening vowel", async () => {
  const manifest = JSON.parse(await readFile("src/audioManifest.json", "utf8"));
  const settings = JSON.parse(
    await readFile(new URL("./synthesis-settings.json", import.meta.url), "utf8"),
  );
  const wav = await readFile(`public/${manifest.clips["الله معك"]}`);
  const previous = await readFile(
    new URL("./fixtures/allah-maak-cracked.wav", import.meta.url),
  );
  checkAllahJoin(wav, settings["الله معك"].preserveTail.generatedEnd);
  const prefixEnd = 44 + Math.round(0.88 * 24000) * 2;
  assert.deepEqual(
    wav.subarray(44, prefixEnd),
    previous.subarray(44, prefixEnd),
    "The approved uh vowel must remain unchanged before the new crossfade",
  );
});
