import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";

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
const expected = [...allPhrases.map((p) => p.ar), "حبيبي"].sort();
assert.deepEqual(
  Object.keys(manifest.clips).sort(),
  expected,
  "Every teaching phrase must have a clip",
);
let bytes = 0;
for (const path of Object.values(manifest.clips)) {
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
  let sum = 0;
  let peak = 0;
  for (let offset = 44; offset < wav.length; offset += 2) {
    const sample = wav.readInt16LE(offset) / 32768;
    sum += sample ** 2;
    peak = Math.max(peak, Math.abs(sample));
  }
  assert.ok(Math.sqrt(sum / (length / 2)) > 0.002, "Non-silent signal");
  assert.ok(peak < 0.999, "No clipped PCM peaks");
  bytes += wav.length;
}
console.log(
  `Verified ${expected.length} clips, ${(bytes / 1024 / 1024).toFixed(1)} MB total. Dialect accuracy still needs native review.`,
);
