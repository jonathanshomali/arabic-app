import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("yalla-welcome-seen-v1", "yes"),
  );
});
const manifest = JSON.parse(
  readFileSync(new URL("../src/audioManifest.json", import.meta.url), "utf8"),
);

async function enablePack(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("yalla-voice", "yalla");
    // Exercise native HTMLAudioElement playback with no system speech available.
    Object.defineProperty(window, "speechSynthesis", {
      value: undefined,
      configurable: true,
    });
    const NativeAudio = window.Audio;
    const audios: HTMLAudioElement[] = [];
    window.Audio = function (src?: string) {
      const audio = new NativeAudio(src);
      audios.push(audio);
      return audio;
    } as typeof Audio;
    Object.assign(window, { testAudios: audios });
  });
}

test("Palestinian clips play and replay without an installed speech voice", async ({
  page,
}) => {
  await enablePack(page);
  await page.goto("/");
  const speaker = page.getByRole("button", { name: "Hear habibi" });
  for (let i = 0; i < 2; i++) {
    await speaker.click();
    await expect(speaker).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() =>
        page.evaluate(() => {
          const audio = (
            window as unknown as { testAudios: HTMLAudioElement[] }
          ).testAudios.at(-1)!;
          return audio.currentTime;
        }),
      )
      .toBeGreaterThan(0);
    await expect(speaker).toHaveAttribute("aria-pressed", "false");
  }
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("rapid replay, next phrase and closing a lesson cancel earlier clips", async ({
  page,
}) => {
  await enablePack(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Let’s get started", exact: true })
    .click();
  const hello = page.getByRole("button", { name: "Hear Hello", exact: true });
  await hello.click();
  await hello.click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const audios = (window as unknown as { testAudios: HTMLAudioElement[] })
          .testAudios;
        return audios.filter((a) => !a.paused).length;
      }),
    )
    .toBe(1);
  await page.getByRole("button", { name: "Next phrase" }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as { testAudios: HTMLAudioElement[] }
        ).testAudios.every((a) => a.paused),
      ),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Hear Hi there", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as { testAudios: HTMLAudioElement[] }
          ).testAudios.at(-1)?.src,
      ),
    )
    .toContain(manifest.clips["أهلين"]);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Leave lesson", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as { testAudios: HTMLAudioElement[] }
        ).testAudios.every((a) => a.paused),
      ),
    )
    .toBe(true);
});

test("Settings previews work and the selected voice persists", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Learning voice")).toHaveValue("yalla");
  const preview = page.getByRole("button", {
    name: "Preview Hello",
    exact: true,
  });
  await preview.click();
  await expect(preview).toHaveAttribute("aria-pressed", "true");
  await expect(preview).toHaveAttribute("aria-pressed", "false");
  await page.getByLabel("Learning voice").selectOption("system");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Learning voice")).toHaveValue("system");
  await page.getByLabel("Pronunciation audio").uncheck();
  await expect(preview).toBeDisabled();
});

test("failed clips report the error and can be retried", async ({ page }) => {
  // Keep actual system SpeechSynthesis (usually no Arabic voice in CI).
  await page.addInitScript(() => localStorage.setItem("yalla-voice", "yalla"));
  await page.route("**/audio/yalla-v1/*.wav", (route) => route.abort());
  await page.goto("/");
  const speaker = page.getByRole("button", { name: "Hear habibi" });
  await speaker.click();
  await expect(page.getByRole("status")).toContainText("clip couldn’t load");
  await page.unroute("**/audio/yalla-v1/*.wav");
  await speaker.click();
  await expect(speaker).toHaveAttribute("aria-pressed", "true");
  await expect(speaker).toHaveAttribute("aria-pressed", "false");
});

test("cancelled pending playback cannot restart audio or report a stale error", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("yalla-voice", "yalla");
    HTMLMediaElement.prototype.play = function () {
      return new Promise((_resolve, reject) => {
        setTimeout(
          () => reject(new DOMException("Cancelled", "AbortError")),
          500,
        );
      });
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Hear habibi" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.waitForTimeout(700);
  await expect(page.getByRole("status")).toHaveCount(0);
});
