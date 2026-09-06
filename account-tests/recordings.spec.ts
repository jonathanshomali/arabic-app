import { test, expect, type BrowserContext, type Page } from "@playwright/test";

test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
  permissions: ["microphone"],
});
const uid = "11111111-1111-4111-8111-111111111111";
const progress = {
  completed: [],
  xp: 0,
  activity: {},
  goal: 30,
  name: "Lina",
  sound: true,
  saved: [],
  practices: 0,
};
async function prepare(
  context: BrowserContext,
  options: {
    failUpload?: boolean;
    signedOut?: boolean;
    unavailable?: boolean;
  } = {},
) {
  const rows = new Map<string, any>();
  const reservations: any[] = [];
  let uploads = 0;
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const user = {
    id: uid,
    aud: "authenticated",
    role: "authenticated",
    email: "lina@example.com",
    user_metadata: { name: "Lina" },
    app_metadata: { provider: "email" },
    created_at: new Date().toISOString(),
  };
  const token = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: uid, exp: expiry, role: "authenticated", aud: "authenticated" })).toString("base64url")}.test-signature`;
  await context.addInitScript(
    ({ token, expiry, user, signedOut }) => {
      localStorage.setItem("yalla-welcome-seen-v1", "yes");
      if (!signedOut)
        localStorage.setItem(
          "yalla-auth",
          JSON.stringify({
            access_token: token,
            refresh_token: "test-refresh",
            token_type: "bearer",
            expires_in: 3600,
            expires_at: expiry,
            user,
          }),
        );
      const tracks: MediaStreamTrack[] = [];
      const getUserMedia = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices,
      );
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        const stream = await getUserMedia(constraints);
        tracks.push(...stream.getTracks());
        return stream;
      };
      Object.assign(window, { testTracks: tracks });
    },
    { token, expiry, user, signedOut: options.signedOut },
  );
  await context.route("https://yalla-test.supabase.co/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    const json = () => request.postDataJSON();
    const reply = (status: number, data: unknown) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (path === "/auth/v1/user") return reply(200, user);
    if (path === "/rest/v1/learner_progress")
      return reply(200, { user_id: uid, progress, version: 0 });
    if (path === "/rest/v1/rpc/voice_contributions_ready")
      return reply(
        options.unavailable ? 404 : 200,
        options.unavailable ? { message: "Missing migration" } : true,
      );
    if (path === "/rest/v1/rpc/begin_voice_contribution") {
      expect(request.headers().accept).toBe(
        "application/vnd.pgrst.object+json",
      );
      const body = json();
      reservations.push(body);
      if (!rows.has(body.p_id))
        rows.set(body.p_id, {
          id: body.p_id,
          user_id: uid,
          phrase_ar: body.p_phrase_ar,
          seconds: body.p_seconds,
          object_path: `${uid}/${body.p_id}.webm`,
          created_at: new Date().toISOString(),
          upload_complete: false,
          review_status: "pending",
        });
      return reply(200, rows.get(body.p_id));
    }
    if (
      path.startsWith("/storage/v1/object/yalla-voice-contributions/") &&
      request.method() === "POST"
    ) {
      uploads++;
      if (options.failUpload && uploads === 1)
        return reply(503, {
          statusCode: "503",
          error: "Unavailable",
          message: "Test network failure",
        });
      return reply(200, { Key: path.split("/storage/v1/object/")[1] });
    }
    if (path === "/rest/v1/rpc/complete_voice_contribution") {
      rows.get(json().p_id).upload_complete = true;
      return reply(200, null);
    }
    if (path === "/rest/v1/voice_contributions")
      return reply(200, [...rows.values()]);
    if (
      path === "/storage/v1/object/yalla-voice-contributions" &&
      request.method() === "DELETE"
    )
      return reply(200, []);
    if (path === "/rest/v1/rpc/delete_voice_contribution") {
      rows.delete(json().p_id);
      return reply(200, null);
    }
    return reply(404, { message: `Unexpected endpoint: ${path}` });
  });
  return {
    rows,
    reservations,
    get uploads() {
      return uploads;
    },
  };
}
async function openPhrase(page: Page) {
  await page.goto("/");
  await page
    .getByRole("navigation", {
      name:
        (page.viewportSize()?.width || 1280) < 700
          ? "Mobile navigation"
          : "Main navigation",
      exact: true,
    })
    .getByRole("button", { name: "Phrasebook", exact: true })
    .click();
  await page.getByRole("button", { name: "Record Hello", exact: true }).click();
}
async function recordTake(page: Page) {
  await page
    .getByRole("button", { name: "Record & contribute", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Stop recording/ }),
  ).toBeVisible();
  await page.waitForTimeout(650);
  await page.getByRole("button", { name: /Stop recording/ }).click();
}

test("native pilot records actual media, automatically contributes, and releases the mic", async ({
  page,
  context,
}) => {
  const backend = await prepare(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await openPhrase(page);
  await expect(
    page.getByText(/every take is automatically uploaded/),
  ).toBeVisible();
  expect(backend.uploads).toBe(0);
  await recordTake(page);
  await expect(page.getByText(/Contributed! Your take/)).toBeVisible();
  expect(backend.reservations[0].p_phrase_ar).toBe("مرحبا");
  expect(backend.reservations[0].p_consent_version).toBe("pilot-v1");
  expect(backend.reservations[0].p_size_bytes).toBeGreaterThan(0);
  expect(backend.uploads).toBe(1);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).testTracks.every(
          (t: MediaStreamTrack) => t.readyState === "ended",
        ),
      ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page.locator("audio").evaluate((a: HTMLAudioElement) => a.readyState),
    )
    .toBeGreaterThanOrEqual(2);
  await page.screenshot({ path: "test-results/recording-mobile.png" });
});

test("failed upload retries the same contribution and can be deleted in Settings", async ({
  page,
  context,
}) => {
  const backend = await prepare(context, { failUpload: true });
  await openPhrase(page);
  await recordTake(page);
  await expect(page.getByRole("alert")).toContainText(
    "hasn’t finished uploading",
  );
  await page.getByRole("button", { name: "Retry upload" }).click();
  await expect(page.getByText(/Contributed! Your take/)).toBeVisible();
  expect(backend.reservations).toHaveLength(2);
  expect(backend.reservations[0].p_id).toBe(backend.reservations[1].p_id);
  expect(backend.rows.size).toBe(1);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open profile settings" }).click();
  await page.getByText(/Your voice contributions/).click();
  await page.getByRole("button", { name: "Delete contribution" }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByText(/No contributions yet/)).toBeVisible();
  expect(backend.rows.size).toBe(0);
});

test("closing during recording stops the microphone without contributing a partial take", async ({
  page,
  context,
}) => {
  const backend = await prepare(context);
  await openPhrase(page);
  await page
    .getByRole("button", { name: "Record & contribute", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Stop recording/ }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).testTracks.every(
          (t: MediaStreamTrack) => t.readyState === "ended",
        ),
      ),
    )
    .toBe(true);
  expect(backend.uploads).toBe(0);
});

test("denied microphone access produces a useful retry message and no upload", async ({
  page,
  context,
}) => {
  const backend = await prepare(context);
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Denied", "NotAllowedError");
    };
  });
  await openPhrase(page);
  await page
    .getByRole("button", { name: "Record & contribute", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Microphone access was denied",
  );
  expect(backend.uploads).toBe(0);
});

test("signed-out visitors are told to sign in before recording", async ({
  page,
  context,
}) => {
  const backend = await prepare(context, { signedOut: true });
  await openPhrase(page);
  await expect(
    page.getByRole("button", { name: "Sign in to record & contribute" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Record & contribute", exact: true }),
  ).toHaveCount(0);
  expect(backend.uploads).toBe(0);
});

test("missing backend setup prevents capture rather than losing submissions", async ({
  page,
  context,
}) => {
  await prepare(context, { unavailable: true });
  await openPhrase(page);
  await expect(
    page.getByText(/Voice contributions aren’t ready yet/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Record & contribute", exact: true }),
  ).toHaveCount(0);
});

test("a late microphone permission result is released after the view closes", async ({
  page,
  context,
}) => {
  const backend = await prepare(context);
  await openPhrase(page);
  await page.evaluate(() => {
    const getMic = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = () =>
      new Promise((resolve) => {
        (window as any).resolveTestMic = async () =>
          resolve(await getMic({ audio: true }));
      });
  });
  await page
    .getByRole("button", { name: "Record & contribute", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Cancel microphone request" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.evaluate(() => (window as any).resolveTestMic());
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).testTracks.length > 0 &&
          (window as any).testTracks.every(
            (t: MediaStreamTrack) => t.readyState === "ended",
          ),
      ),
    )
    .toBe(true);
  expect(backend.uploads).toBe(0);
});

test("recording stops automatically at the twenty-second limit", async ({
  page,
  context,
}) => {
  const backend = await prepare(context);
  await page.clock.install();
  await openPhrase(page);
  await page
    .getByRole("button", { name: "Record & contribute", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Stop recording/ }),
  ).toBeVisible();
  await page.waitForTimeout(650);
  await page.clock.fastForward(21000);
  await expect(page.getByText(/Contributed! Your take/)).toBeVisible();
  expect(backend.reservations[0].p_seconds).toBe(20);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).testTracks.every(
          (t: MediaStreamTrack) => t.readyState === "ended",
        ),
      ),
    )
    .toBe(true);
});
