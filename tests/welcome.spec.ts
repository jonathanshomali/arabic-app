import { test, expect } from "@playwright/test";

test("new visitors meet Zaytoun once and hear the default Palestinian voice", async ({
  page,
}) => {
  const clips: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/audio/yalla-v1/")) clips.push(request.url());
  });
  await page.goto("/");
  const welcome = page.getByRole("dialog", { name: "Meet Zaytoun" });
  await expect(welcome).toBeVisible();
  await expect(welcome.getByRole("img", { name: /Zaytoun/ })).toBeVisible();
  await expect(welcome).toContainText("I’m still finding my voice!");
  await expect(welcome).toContainText("experimental feature");
  await expect(welcome).toContainText("guide in training");
  expect(clips).toHaveLength(0);
  const hello = welcome.getByRole("button", { name: "Hear my hello" });
  await hello.click();
  await expect(hello).toHaveAttribute("aria-pressed", "true");
  await expect(hello).toHaveAttribute("aria-pressed", "false");
  expect(clips.length).toBeGreaterThan(0);
  await welcome.getByRole("button", { name: "Yalla, let’s learn!" }).click();
  await expect(welcome).toHaveCount(0);
  await page.reload();
  await expect(welcome).toHaveCount(0);
  await page.getByRole("button", { name: "Open profile settings" }).click();
  await expect(page.getByLabel("Learning voice")).toHaveValue("yalla");
});

test("welcome fits a phone and keyboard dismissal is remembered", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  const welcome = page.getByRole("dialog", { name: "Meet Zaytoun" });
  await expect(welcome).toBeVisible();
  expect(await welcome.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await welcome
    .getByRole("button", { name: "Yalla, let’s learn!" })
    .scrollIntoViewIfNeeded();
  await expect(
    welcome.getByRole("button", { name: "Yalla, let’s learn!" }),
  ).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(welcome).toHaveCount(0);
  await page.reload();
  await expect(welcome).toHaveCount(0);
});

test("an explicit device-voice preference survives the new default", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("yalla-voice", "system");
    localStorage.setItem("yalla-welcome-seen-v1", "yes");
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open profile settings" }).click();
  await expect(page.getByLabel("Learning voice")).toHaveValue("system");
});
