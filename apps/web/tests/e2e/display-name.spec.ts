import { expect, test, type Page } from "@playwright/test";

/**
 * 表示名更新フローの e2e。
 *
 * CI では web を `next start` で単体起動するだけで API/DB は立てないため、
 * better-auth の `/api/auth/*` と REST の `/api/v1/me` を route interception でモックする。
 * web と API は別オリジン(NEXT_PUBLIC_API_URL)なので、fulfill するレスポンスにも
 * ブラウザの CORS 検証が効く。CORS ヘッダの付与と OPTIONS プリフライト処理が必須。
 */

const FALLBACK_ORIGIN = "http://127.0.0.1:3000";

function corsHeaders(origin: string, methods = "GET,POST,OPTIONS") {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type, x-signup-intent, x-captcha-response",
    "access-control-allow-methods": methods,
  };
}

const NOW = "2026-07-15T00:00:00.000Z";
const EXPIRES = "2026-07-22T00:00:00.000Z";

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user_1",
    email: "test@example.com",
    emailVerified: true,
    name: "",
    image: null,
    createdAt: NOW,
    updatedAt: NOW,
    role: "user",
    displayName: "テスト太郎",
    ...overrides,
  };
}

function makeSession() {
  return {
    id: "sess_1",
    token: "tok_1",
    userId: "user_1",
    expiresAt: EXPIRES,
    createdAt: NOW,
    updatedAt: NOW,
    ipAddress: "",
    userAgent: "",
  };
}

type SessionPayload = { session: object; user: object } | null;

/**
 * `/api/auth/*` と `/api/v1/me` をモックする。
 * PATCH /api/v1/me で state.session.user.displayName を更新し、
 * 以降の get-session に反映される。
 */
async function mockDisplayNameFlow(page: Page) {
  const state: { session: SessionPayload } = {
    session: { session: makeSession(), user: makeUser() },
  };

  await page.route("**/api/auth/**", async (route) => {
    const request = route.request();
    const origin = request.headers()["origin"] ?? FALLBACK_ORIGIN;
    const cors = corsHeaders(origin);

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }

    const path = new URL(request.url()).pathname;
    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        headers: { ...cors, "content-type": "application/json" },
        body: JSON.stringify(body),
      });

    if (path.endsWith("/get-session")) {
      await json(200, state.session);
      return;
    }
    if (path.endsWith("/sign-out")) {
      state.session = null;
      await json(200, { success: true });
      return;
    }
    await json(200, {});
  });

  await page.route("**/api/v1/me", async (route) => {
    const request = route.request();
    const origin = request.headers()["origin"] ?? FALLBACK_ORIGIN;
    const cors = corsHeaders(origin, "GET,POST,OPTIONS,PATCH");

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }

    if (request.method() === "PATCH") {
      const body = request.postDataJSON() as { displayName?: string | null };
      if (state.session?.user) {
        (state.session.user as { displayName?: string | null }).displayName = body.displayName ?? null;
      }
      const user = (state.session?.user ?? makeUser()) as ReturnType<typeof makeUser>;
      await route.fulfill({
        status: 200,
        headers: { ...cors, "content-type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          displayName: body.displayName ?? null,
        }),
      });
      return;
    }

    await route.fulfill({ status: 404, headers: cors });
  });

  return { state };
}

test.describe("表示名更新", () => {
  test("表示名を保存すると PATCH が送信されダッシュボードに反映される", async ({ page }) => {
    await mockDisplayNameFlow(page);

    await page.goto("/dashboard");

    await expect(page.getByText("テスト太郎")).toBeVisible();

    await page.getByLabel("表示名").fill("新しい名前");

    const patchRequest = page.waitForRequest("**/api/v1/me");
    await page.getByRole("button", { name: "表示名を保存" }).click();
    const request = await patchRequest;

    expect(request.method()).toBe("PATCH");
    expect(request.postDataJSON()).toEqual({ displayName: "新しい名前" });

    await expect(page.getByText("保存しました。")).toBeVisible();

    // dl の先頭行が表示名。refetch 後のセッション反映で新しい表示名が出ることを確認する。
    await expect(page.locator("dl dd").first()).toHaveText("新しい名前");
  });
});
