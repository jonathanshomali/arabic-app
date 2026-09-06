import { test, expect, type Page } from "@playwright/test";
import { allPhrases, lessons } from "../src/data";
const answers = Object.fromEntries(allPhrases.map((p) => [p.ar, p.en]));
async function takeQuiz(page: Page, correct = true) {
  for (let i = 0; i < 5; i++) {
    const phrase = (
      await page.locator(".quiz-phrase [lang=ar]").innerText()
    ).trim();
    const options = page.locator(".answer-options button");
    const labels = await options.allTextContents();
    const answerIndex = labels.findIndex(
      (text) => text.trim().replace(/^\d+\s*/, "") === answers[phrase],
    );
    expect(answerIndex).toBeGreaterThanOrEqual(0);
    await options
      .nth(correct ? answerIndex : (answerIndex + 1) % labels.length)
      .click();
    await page
      .getByRole("button", { name: "Check answer", exact: true })
      .click();
    await expect(page.getByRole("status")).toBeVisible();
    await page
      .getByRole("button", {
        name: i === 4 ? "See how you did" : "Continue",
        exact: true,
      })
      .click();
  }
}
test("lesson earns XP, unlocks the next lesson and persists after reload", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Locked: How are you?" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Let’s get started", exact: true })
    .click();
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "Next phrase" }).click();
  await page.getByRole("button", { name: "Let’s try a little quiz" }).click();
  await expect(
    page.getByRole("button", { name: "Check answer" }),
  ).toBeDisabled();
  await takeQuiz(page);
  await expect(page.getByText("Look at you, speaking Arabic!")).toBeVisible();
  await expect(page.locator(".result-stats")).toContainText("+30");
  await page.getByRole("button", { name: "Back to my journey" }).click();
  await expect(
    page.getByRole("button", { name: "Start: How are you?" }),
  ).toBeEnabled();
  await page.reload();
  await expect(page.getByText("1 of 16 lessons complete")).toBeVisible();
  await expect(page.locator(".top-stats")).toContainText("30");
  await expect(page.locator(".goal-foot")).toContainText("Daily goal complete");
});
test("failed practice awards no XP and can be retried successfully", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("button", { name: "Practice", exact: true })
    .click();
  await page.getByRole("button", { name: "Start daily practice" }).click();
  await takeQuiz(page, false);
  await expect(page.getByText("You’re getting there.")).toBeVisible();
  await expect(page.locator(".result-stats")).toContainText("+0");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await takeQuiz(page);
  await expect(page.locator(".result-stats")).toContainText("+10");
  await page.getByRole("button", { name: "Back to my journey" }).click();
  const progress = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("yalla-progress")!),
  );
  expect(progress.xp).toBe(10);
  expect(progress.completed).toEqual([]);
  expect(progress.practices).toBe(1);
});
test("phrase search, favorites and settings persist", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("button", { name: "Phrasebook", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Search phrases" }).fill("marhaba");
  await expect(page.locator(".phrase-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Save Hello", exact: true }).click();
  await page.getByRole("textbox", { name: "Search phrases" }).fill("");
  await page.getByRole("button", { name: "Saved", exact: true }).click();
  await expect(page.locator(".phrase-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Open profile settings" }).click();
  await page.getByLabel("Your first name").fill("Lina");
  await page.getByLabel("Your daily goal").selectOption("60");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Ahlan, Lina! Let’s learn a little." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("yalla-progress")!).saved,
    ),
  ).toEqual(["مرحبا"]);
});
test("mobile navigation and layout fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("button", { name: "Progress" })
    .click();
  await expect(page.getByText("Your week in words")).toBeVisible();
  await page.getByRole("button", { name: "Open profile settings" }).click();
  await page
    .getByRole("button", { name: "Reset progress", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Yes, reset my progress" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
});
test("desktop renders without browser errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(
    page.getByRole("heading", { name: "Your learning path" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("leaving a lesson asks first and Escape closes a completed result", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Let’s get started", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Pause this lesson?")).toBeVisible();
  await page
    .getByRole("button", { name: "Keep learning", exact: true })
    .click();
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "Next phrase" }).click();
  await page.getByRole("button", { name: "Let’s try a little quiz" }).click();
  await takeQuiz(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("1 of 16 lessons complete")).toBeVisible();
});

test("every phrase has its own tip, and the teaching card changes with the word", async ({
  page,
}) => {
  expect(lessons).toHaveLength(16);
  expect(allPhrases).toHaveLength(80);
  expect(new Set(allPhrases.map((p) => p.ar)).size).toBe(80);
  for (const lesson of lessons) {
    expect(lesson.phrases).toHaveLength(5);
    expect(new Set(lesson.phrases.map((p) => p.tip)).size).toBe(5);
    for (const phrase of lesson.phrases)
      expect(phrase.tip?.length).toBeGreaterThan(30);
  }
  await page.goto("/");
  await page
    .getByRole("button", { name: "Let’s get started", exact: true })
    .click();
  for (const [i, phrase] of lessons[0].phrases.entries()) {
    await expect(page.locator(".learn-arabic")).toHaveText(phrase.ar);
    await expect(page.locator(".lesson-tip p")).toHaveText(phrase.tip!);
    if (i < 4) await page.getByRole("button", { name: "Next phrase" }).click();
  }
});

test("a returning learner keeps 250 XP and can complete the first new lesson", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("yalla-progress"))
      localStorage.setItem(
        "yalla-progress",
        JSON.stringify({
          completed: [0, 1, 2, 3, 4, 5, 6, 7],
          xp: 250,
          activity: { "2026-09-05": 250 },
          goal: 30,
          name: "Lina",
          sound: true,
          saved: ["مرحبا"],
          practices: 1,
        }),
      );
  });
  await page.goto("/");
  await expect(page.locator(".top-stats")).toContainText("250");
  await expect(
    page.getByRole("button", {
      name: "Start: The people in your life",
      exact: true,
    }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Locked: Count me in", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Start unit 2 review" }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Continue learning", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveAttribute(
    "aria-label",
    "The people in your life",
  );
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "Next phrase" }).click();
  await page.getByRole("button", { name: "Let’s try a little quiz" }).click();
  await takeQuiz(page);
  await page.getByRole("button", { name: "Back to my journey" }).click();
  await page.reload();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("yalla-progress")!),
  );
  expect(stored.xp).toBe(280);
  expect(stored.saved).toEqual(["مرحبا"]);
  expect(stored.completed).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  await expect(
    page.getByRole("button", { name: "Start: Count me in", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("button", { name: "My progress", exact: true })
    .click();
  await expect(
    page.locator(".achievement").filter({ hasText: "Out into the world" }),
  ).toHaveClass(/earned/);
});

test("Arabic text and new units fit small and large home pages", async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const greeting = page.locator(".greeting-arabic");
    await expect(greeting).toBeVisible();
    const metrics = await greeting.evaluate((el) => {
      const r = el.getBoundingClientRect(),
        h = el.closest(".hero")!.getBoundingClientRect(),
        style = getComputedStyle(el);
      return {
        inside:
          r.top >= h.top &&
          r.bottom <= h.bottom &&
          r.left >= h.left &&
          r.right <= h.right,
        line: parseFloat(style.lineHeight) / parseFloat(style.fontSize),
      };
    });
    expect(metrics.inside).toBe(true);
    expect(metrics.line).toBeGreaterThanOrEqual(1.8);
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: `test-results/refined-${width}.png`,
        fullPage: true,
      });
  }
});

for (const lesson of lessons.slice(9)) {
  test(`new lesson can be completed: ${lesson.title}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((id) => {
      localStorage.setItem(
        "yalla-progress",
        JSON.stringify({
          completed: Array.from({ length: id }, (_, i) => i),
          xp: 250,
          activity: {},
          goal: 30,
          name: "",
          sound: true,
          saved: [],
          practices: 1,
        }),
      );
    }, lesson.id);
    await page.goto("/");
    await page
      .getByRole("button", { name: "Continue learning", exact: true })
      .click();
    for (const [i, phrase] of lesson.phrases.entries()) {
      await expect(page.locator(".learn-arabic")).toHaveText(phrase.ar);
      await expect(page.locator(".lesson-tip p")).toHaveText(phrase.tip!);
      expect(
        await page
          .locator(".modal")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      if (i < 4)
        await page.getByRole("button", { name: "Next phrase" }).click();
    }
    await page.getByRole("button", { name: "Let’s try a little quiz" }).click();
    await takeQuiz(page);
    await expect(page.locator(".result-stats")).toContainText("+30");
  });
}
