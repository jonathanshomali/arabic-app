import { test, expect, type Page } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("yalla-welcome-seen-v1", "yes");
    localStorage.setItem("yalla-voice", "system");
  });
});
async function mockSpeech(
  page: Page,
  options: { delayed?: boolean; failFirst?: boolean } = {},
) {
  await page.addInitScript((options) => {
    class MockUtterance {
      text: string;
      voice: unknown = null;
      lang = "";
      rate = 1;
      onstart: ((event: unknown) => void) | null = null;
      onend: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      value: MockUtterance,
      configurable: true,
    });
    class MockSpeech extends EventTarget {
      speaking = false;
      pending = false;
      paused = true;
      ready = !options.delayed;
      calls: string[] = [];
      resumes = 0;
      ends = 0;
      active: SpeechSynthesisUtterance | null = null;
      getVoices() {
        return this.ready
          ? [
              {
                name: "Arabic test voice",
                lang: "ar-PS",
                localService: true,
                default: true,
                voiceURI: "test",
              },
            ]
          : [];
      }
      resume() {
        this.paused = false;
        this.resumes++;
      }
      cancel() {
        this.speaking = false;
        this.pending = false;
        const u = this.active;
        this.active = null;
        u?.onerror?.({ error: "canceled" } as SpeechSynthesisErrorEvent);
      }
      speak(u: SpeechSynthesisUtterance) {
        this.calls.push(u.text);
        this.active = u;
        this.speaking = true;
        const fail = options.failFirst && this.calls.length === 1;
        setTimeout(() => {
          if (this.active !== u) return;
          if (fail) {
            this.speaking = false;
            this.active = null;
            u.onerror?.({
              error: "synthesis-failed",
            } as SpeechSynthesisErrorEvent);
            return;
          }
          u.onstart?.({} as SpeechSynthesisEvent);
          setTimeout(() => {
            if (this.active !== u) return;
            this.speaking = false;
            this.active = null;
            this.ends++;
            u.onend?.({} as SpeechSynthesisEvent);
          }, 150);
        }, 25);
      }
    }
    const synth = new MockSpeech();
    Object.defineProperty(window, "speechSynthesis", {
      value: synth,
      configurable: true,
    });
    Object.assign(window, { testSpeech: synth });
  }, options);
}
const calls = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { testSpeech: { calls: string[] } }).testSpeech
        .calls,
  );

test("audio replays after finishing, resumes paused synthesis and follows the next word", async ({
  page,
}) => {
  await mockSpeech(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Let’s get started", exact: true })
    .click();
  const hello = page.getByRole("button", { name: "Hear Hello", exact: true });
  await hello.click();
  await expect(hello).toHaveAttribute("aria-pressed", "true");
  await expect(hello).toHaveAttribute("aria-pressed", "false");
  await hello.click();
  await expect.poll(() => calls(page)).toEqual(["مرحبا", "مرحبا"]);
  await page.getByRole("button", { name: "Next phrase" }).click();
  await page
    .getByRole("button", { name: "Hear Hi there", exact: true })
    .click();
  await expect.poll(() => calls(page)).toEqual(["مرحبا", "مرحبا", "أهلين"]);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { testSpeech: { resumes: number } }).testSpeech
          .resumes,
    ),
  ).toBeGreaterThan(0);
  await expect(
    page.getByText("Audio couldn’t play.", { exact: false }),
  ).toHaveCount(0);
});

test("a voice that loads after the tap can still play", async ({ page }) => {
  await mockSpeech(page, { delayed: true });
  await page.goto("/");
  await page.getByRole("button", { name: "Hear habibi" }).click();
  await page.evaluate(() => {
    const s = (
      window as unknown as { testSpeech: EventTarget & { ready: boolean } }
    ).testSpeech;
    s.ready = true;
    s.dispatchEvent(new Event("voiceschanged"));
  });
  await expect.poll(() => calls(page)).toEqual(["حبيبي"]);
  await expect(
    page.getByRole("button", { name: "Hear habibi" }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("playback errors leave the speaker ready for another try", async ({
  page,
}) => {
  await mockSpeech(page, { failFirst: true });
  await page.goto("/");
  const button = page.getByRole("button", { name: "Hear habibi" });
  await button.click();
  await expect(page.getByRole("status")).toContainText("Audio couldn’t play");
  await button.click();
  await expect.poll(() => calls(page)).toEqual(["حبيبي", "حبيبي"]);
  await expect(button).toHaveAttribute("aria-pressed", "false");
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { testSpeech: { ends: number } }).testSpeech.ends,
    ),
  ).toBe(1);
});

test("missing Arabic voices report a useful message and do not stay active", async ({
  page,
}) => {
  await mockSpeech(page, { delayed: true });
  await page.goto("/");
  const button = page.getByRole("button", { name: "Hear habibi" });
  await button.click();
  await expect(page.getByRole("status")).toContainText(
    "No Arabic voice is available yet",
  );
  await expect(button).toHaveAttribute("aria-pressed", "false");
  expect(await calls(page)).toEqual([]);
});

test("rapid replay replaces the current voice without a false cancellation error", async ({
  page,
}) => {
  await mockSpeech(page);
  await page.goto("/");
  const speaker = page.getByRole("button", { name: "Hear habibi" });
  await speaker.click();
  await expect.poll(() => calls(page)).toHaveLength(1);
  await speaker.click();
  await expect.poll(() => calls(page)).toHaveLength(2);
  await expect(speaker).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("status")).toHaveCount(0);
});
