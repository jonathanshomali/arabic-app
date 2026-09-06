import { build } from "esbuild";
import { writeFile } from "node:fs/promises";

// Bundle the actual curriculum so missing/new phrases cannot silently escape coverage.
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
await writeFile(
  "scripts/voice/phrases.json",
  JSON.stringify(
    [
      ...allPhrases.map(({ ar, latin, en }) => ({ ar, latin, en })),
      { ar: "حبيبي", latin: "habibi", en: "My dear" },
    ],
    null,
    2,
  ) + "\n",
);
