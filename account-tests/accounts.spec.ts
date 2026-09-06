import { test, expect, type Page, type BrowserContext } from "@playwright/test";
const baseProgress = {
  completed: [],
  xp: 0,
  activity: {},
  goal: 30,
  name: "",
  sound: true,
  saved: [],
  practices: 0,
};
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const password = "Olive trees grow together!";
function session(id: string, email: string) {
  const payload = {
    sub: id,
    role: "authenticated",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  };
  const token = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.test-signature`;
  return {
    access_token: token,
    refresh_token: `refresh-${id}`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: payload.exp,
    user: {
      id,
      aud: "authenticated",
      role: "authenticated",
      email,
      email_confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { name: id === alice ? "Alice" : "Bob" },
      identities: [],
    },
  };
}
function createBackend() {
  const rows = new Map([
    [
      alice,
      {
        progress: { ...baseProgress, name: "Alice", xp: 30, completed: [0] },
        version: 0,
      },
    ],
    [
      bob,
      {
        progress: { ...baseProgress, name: "Bob", xp: 60, completed: [0, 1] },
        version: 0,
      },
    ],
  ]);
  let saveFailure = false,
    loadFailure = false,
    resetCount = 0,
    signupCount = 0;
  const writes: unknown[] = [];
  async function install(context: BrowserContext) {
    await context.route("https://yalla-test.supabase.co/**", async (route) => {
      const request = route.request(),
        url = new URL(request.url()),
        body = request.postDataJSON();
      let id = "";
      try {
        id = JSON.parse(
          Buffer.from(
            (request.headers().authorization || "").split(".")[1],
            "base64url",
          ).toString(),
        ).sub;
      } catch {}
      const reply = (status: number, json: unknown) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(json),
        });
      if (url.pathname === "/auth/v1/token") {
        if (body?.password && body.password !== password)
          return reply(400, {
            error: "invalid_grant",
            error_description: "Invalid login credentials",
            code: "invalid_credentials",
          });
        const uid = body?.email === "bob@example.com" ? bob : alice;
        return reply(
          200,
          session(uid, uid === alice ? "alice@example.com" : "bob@example.com"),
        );
      }
      if (url.pathname === "/auth/v1/signup") {
        signupCount++;
        return reply(200, {
          ...session(alice, body.email).user,
          identities: [{ id: alice }],
          confirmation_sent_at: new Date().toISOString(),
        });
      }
      if (url.pathname === "/auth/v1/logout") return reply(204, null);
      if (url.pathname === "/auth/v1/recover") {
        resetCount++;
        return reply(200, {});
      }
      if (url.pathname === "/auth/v1/user")
        return reply(
          200,
          session(
            id || alice,
            id === bob ? "bob@example.com" : "alice@example.com",
          ).user,
        );
      if (url.pathname === "/rest/v1/learner_progress") {
        if (loadFailure)
          return reply(503, { message: "Unavailable", code: "503" });
        const row = rows.get(id);
        if (!row) return reply(401, { message: "Unauthenticated" });
        return reply(200, { user_id: id, ...row });
      }
      if (url.pathname === "/rest/v1/rpc/save_learner_progress") {
        writes.push(body);
        if (saveFailure)
          return reply(503, { message: "Unavailable", code: "503" });
        const row = rows.get(id);
        if (!row) return reply(401, { message: "Unauthenticated" });
        if (body.p_expected_version !== row.version)
          return reply(409, { message: "Conflict", code: "40001" });
        const next = { progress: body.p_progress, version: row.version + 1 };
        rows.set(id, next);
        return reply(200, [{ user_id: id, ...next }]);
      }
      return reply(404, { message: "Unexpected mock endpoint" });
    });
  }
  return {
    rows,
    writes,
    install,
    setSaveFailure: (v: boolean) => (saveFailure = v),
    setLoadFailure: (v: boolean) => (loadFailure = v),
    get resetCount() {
      return resetCount;
    },
    get signupCount() {
      return signupCount;
    },
  };
}
async function signIn(page: Page, email = "alice@example.com") {
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in & keep learning" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function rename(page: Page, name: string) {
  await page.getByRole("button", { name: "Open profile settings" }).click();
  await page.getByLabel("Your first name").fill(name);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
}

test("signup masks passwords, validates confirmation and never stores the password", async ({
  page,
  context,
}) => {
  const backend = createBackend();
  await backend.install(context);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Save my progress", exact: true })
    .click();
  await page.getByLabel("Your first name").fill("Lina");
  await page.getByLabel("Email address").fill("lina@example.com");
  const input = page.getByLabel("Password", { exact: true });
  await input.fill(password);
  await expect(input).toHaveAttribute("type", "password");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(input).toHaveAttribute("type", "text");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("Something different!");
  await page
    .getByRole("button", { name: "Create my account", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("don’t match");
  expect(backend.signupCount).toBe(0);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create my account", exact: true })
    .click();
  await expect(page.locator(".auth-success")).toContainText("Check your inbox");
  expect(backend.signupCount).toBe(1);
  const stored = await page.evaluate(() =>
    JSON.stringify({ ...localStorage, ...sessionStorage }),
  );
  expect(stored).not.toContain(password);
});

test("account saves sync to a second browser and signout restores guest isolation", async ({
  page,
  context,
  browser,
}) => {
  const backend = createBackend();
  await backend.install(context);
  await page.addInitScript(() => {
    if (!localStorage.getItem("yalla-progress"))
      localStorage.setItem(
        "yalla-progress",
        JSON.stringify({
          completed: [0, 1, 2, 3, 4, 5, 6, 7],
          xp: 250,
          activity: {},
          goal: 30,
          name: "Guest",
          sound: true,
          saved: ["مرحبا"],
          practices: 1,
        }),
      );
  });
  await page.goto("/");
  await signIn(page);
  await expect(
    page.getByRole("heading", { name: "Ahlan, Alice! Let’s learn a little." }),
  ).toBeVisible();
  await rename(page, "Alicia");
  await expect(page.locator(".account-status")).toContainText(
    "saved to your account",
  );
  expect(backend.rows.get(alice)?.progress.name).toBe("Alicia");
  const second = await browser.newContext();
  await backend.install(second);
  const otherPage = await second.newPage();
  await otherPage.goto("http://127.0.0.1:5174/");
  await signIn(otherPage);
  await expect(
    otherPage.getByRole("heading", {
      name: "Ahlan, Alicia! Let’s learn a little.",
    }),
  ).toBeVisible();
  await second.close();
  await page.getByRole("button", { name: "Open profile settings" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ahlan, Guest! Let’s learn a little." }),
  ).toBeVisible();
  await expect(page.locator(".top-stats")).toContainText("250");
  await signIn(page, "bob@example.com");
  await expect(
    page.getByRole("heading", { name: "Ahlan, Bob! Let’s learn a little." }),
  ).toBeVisible();
  await expect(page.locator(".top-stats")).toContainText("60");
  expect(
    await page.evaluate(() => localStorage.getItem("yalla-progress")),
  ).not.toContain("Alicia");
});

test("guest progress import is explicit and does not duplicate XP", async ({
  page,
  context,
}) => {
  const backend = createBackend();
  await backend.install(context);
  await page.addInitScript(() =>
    localStorage.setItem(
      "yalla-progress",
      JSON.stringify({
        completed: [0, 1, 2, 3, 4, 5, 6, 7],
        xp: 250,
        activity: { "2026-09-05": 250 },
        goal: 30,
        name: "Guest",
        sound: true,
        saved: ["مرحبا"],
        practices: 1,
      }),
    ),
  );
  await page.goto("/");
  await signIn(page);
  await expect(page.locator(".top-stats")).toContainText("30");
  await page.getByRole("button", { name: "Open profile settings" }).click();
  await page.getByRole("button", { name: "Import guest progress" }).click();
  await expect.poll(() => backend.rows.get(alice)?.progress.xp).toBe(250);
  await page.getByRole("button", { name: "Import guest progress" }).click();
  await expect.poll(() => backend.rows.get(alice)?.version).toBe(2);
  expect(backend.rows.get(alice)?.progress.xp).toBe(250);
  expect(backend.rows.get(alice)?.progress.completed).toHaveLength(8);
});

test("failed sync survives reload and can be retried without overwriting an account with zero", async ({
  page,
  context,
}) => {
  const backend = createBackend();
  await backend.install(context);
  await page.goto("/");
  await signIn(page);
  await expect(page.locator(".account-status")).toContainText(
    "saved to your account",
  );
  backend.setSaveFailure(true);
  await rename(page, "Offline Alice");
  await expect(page.locator(".account-status")).toContainText(
    "cloud sync failed",
  );
  const pending = await page.evaluate(
    (id) => JSON.parse(localStorage.getItem(`yalla-pending:${id}`)!),
    alice,
  );
  expect(pending.progress.name).toBe("Offline Alice");
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Ahlan, Offline Alice! Let’s learn a little.",
    }),
  ).toBeVisible();
  backend.setSaveFailure(false);
  await page.getByRole("button", { name: "Retry sync" }).click();
  await expect(page.locator(".account-status")).toContainText(
    "saved to your account",
  );
  expect(backend.rows.get(alice)?.progress.name).toBe("Offline Alice");
  expect(backend.rows.get(alice)?.progress.xp).toBe(30);
});

test("cloud load failures prevent edits and never write empty progress", async ({
  page,
  context,
}) => {
  const backend = createBackend();
  await backend.install(context);
  backend.setLoadFailure(true);
  await page.goto("/");
  await signIn(page);
  await expect(page.locator(".account-status")).toContainText("Couldn’t load", {
    timeout: 15000,
  });
  expect(backend.writes).toHaveLength(0);
  await expect(page.locator("main")).toHaveAttribute("inert", "");
  backend.setLoadFailure(false);
  await page.getByRole("button", { name: "Retry sync" }).click();
  await expect(
    page.getByRole("heading", { name: "Ahlan, Alice! Let’s learn a little." }),
  ).toBeVisible();
  expect(backend.rows.get(alice)?.progress.xp).toBe(30);
});

test("concurrent updates require an explicit conflict choice", async ({
  page,
  context,
}) => {
  const backend = createBackend();
  await backend.install(context);
  await page.goto("/");
  await signIn(page);
  await expect(page.locator(".account-status")).toContainText(
    "saved to your account",
  );
  backend.rows.set(alice, {
    progress: {
      ...baseProgress,
      name: "Other device",
      xp: 90,
      completed: [0, 1, 2],
    },
    version: 1,
  });
  await rename(page, "This device");
  await expect(page.locator(".account-status")).toContainText(
    "changed on another device",
  );
  expect(backend.rows.get(alice)?.progress.xp).toBe(90);
  await page.getByRole("button", { name: "Resolve", exact: true }).click();
  await page.getByRole("button", { name: "Use cloud progress" }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Ahlan, Other device! Let’s learn a little.",
    }),
  ).toBeVisible();
  await expect(page.locator(".top-stats")).toContainText("90");
});

test("password reset requests use HTTPS and do not disclose whether an email exists", async ({
  page,
  context,
}) => {
  const backend = createBackend();
  await backend.install(context);
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Forgot your password?" }).click();
  await page.getByLabel("Email address").fill("unknown@example.com");
  const request = page.waitForRequest((r) =>
    r.url().includes("/auth/v1/recover"),
  );
  await page.getByRole("button", { name: "Send reset link" }).click();
  expect((await request).url()).toMatch(/^https:\/\//);
  await expect(page.locator(".auth-success")).toContainText(
    "If an account exists",
  );
  expect(backend.resetCount).toBe(1);
});

test("recovery links open password update and send the new password only to Auth", async ({
  page,
  context,
}) => {
  const backend = createBackend();
  await backend.install(context);
  await page.addInitScript(() =>
    localStorage.setItem(
      "yalla-auth-code-verifier",
      JSON.stringify("test-verifier/recovery"),
    ),
  );
  await page.goto("/?code=test-recovery-code");
  await expect(page.getByRole("dialog")).toHaveAttribute(
    "aria-label",
    "Choose a new password.",
  );
  const newPassword = "My new olive grove passphrase!";
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm password", { exact: true }).fill(newPassword);
  const update = page.waitForRequest(
    (r) => r.url().includes("/auth/v1/user") && r.method() === "PUT",
  );
  await page
    .getByRole("button", { name: "Save new password", exact: true })
    .click();
  expect((await update).postDataJSON().password).toBe(newPassword);
  await expect(page.locator(".auth-success")).toContainText(
    "Your new password is saved",
  );
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    ),
  ).not.toContain(newPassword);
  expect(JSON.stringify(backend.writes)).not.toContain(newPassword);
});

test("phone signup fits the viewport and invalid sign-in stays on the form", async ({
  page,
  context,
}) => {
  const backend = createBackend();
  await backend.install(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Email address").fill("alice@example.com");
  await page.getByLabel("Password", { exact: true }).fill("wrong password");
  await page.getByRole("button", { name: "Sign in & keep learning" }).click();
  await expect(page.getByRole("alert")).toContainText("Couldn’t sign in");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByLabel("Your first name")).toBeVisible();
  expect(
    await page
      .locator(".modal")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/account-phone.png",
    fullPage: true,
  });
});
