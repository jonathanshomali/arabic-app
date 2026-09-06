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
