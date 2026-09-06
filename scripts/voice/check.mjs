import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { checkSignal } from "./audio-quality.mjs";
import { createHash } from "node:crypto";

const result = await build({
  entryPoints: ["src/data.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { allPhrases } = await import(
  "data:text/javascript;base64," +
    Buffer.from(result.outputFiles[0].text).toString("base64")
);
const manifest = JSON.parse(await readFile("src/audioManifest.json", "utf8"));
const recognition = JSON.parse(
  await readFile("scripts/voice/recognition.json", "utf8"),
);
const recognized = new Map(recognition.clips.map((row) => [row.phrase, row]));
const expected = [...allPhrases.map((p) => p.ar), "حبيبي"].sort();
assert.deepEqual(
  Object.keys(manifest.clips).sort(),
  expected,
  "Every teaching phrase must have a clip",
);
let bytes = 0;
for (const [phrase, path] of Object.entries(manifest.clips)) {
  assert.match(path, /^audio\/yalla-v1\/[a-f0-9]{16}\.wav$/);
  const wav = await readFile(`public/${path}`);
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.toString("ascii", 8, 12), "WAVE");
  // The generator writes canonical mono 16-bit PCM WAV using libsndfile.
  assert.equal(wav.toString("ascii", 12, 16), "fmt ");
  assert.equal(wav.readUInt16LE(20), 1, "PCM");
  assert.equal(wav.readUInt16LE(22), 1, "Mono");
  assert.equal(wav.readUInt32LE(24), 24000);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.toString("ascii", 36, 40), "data");
  const length = wav.readUInt32LE(40);
  assert.equal(length + 44, wav.length);
  assert.ok(
    length / 48000 >= 0.25 && length / 48000 <= 15,
    "Reasonable duration",
  );
  checkSignal(wav);
  const row = recognized.get(phrase);
  assert.ok(row, `Missing speech-recognition result: ${phrase}`);
  assert.equal(row.file, path);
  assert.equal(
    row.sha256,
    createHash("sha256").update(wav).digest("hex"),
    `Stale speech-recognition result: ${phrase}. Re-run recognize.py.`,
  );
  bytes += wav.length;
}

// A compact set of one- and multi-word speech anchors. Normalize orthographic
// variants, not pronunciation, and never prompt the recognizer with the answer.
const normalize = (text) =>
  text
    .normalize("NFKC")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\u0621-\u063a\u0641-\u064a]/g, "");
function distance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    previous = next;
  }
  return previous[b.length];
}
for (const phrase of [
  "مرحبا",
  "شكراً",
  "أنا من فلسطين",
  "بدي قهوة",
  "الله معك",
]) {
  const expectedText = normalize(phrase);
  const heard = normalize(recognized.get(phrase).transcript);
  assert.ok(
    distance(expectedText, heard) / expectedText.length <= 0.35,
    `Speech recognition failed for ${phrase}: ${recognized.get(phrase).transcript}`,
  );
}
console.log(
  `Verified ${expected.length} clips, ${(bytes / 1024 / 1024).toFixed(1)} MB total. Dialect accuracy still needs native review.`,
);
