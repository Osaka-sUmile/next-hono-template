import { expect, test, type Page } from "@playwright/test";

/**
 * 認証フローの e2e。
 *
 * CI では web を `next start` で単体起動するだけで API/DB は立てないため、
 * better-auth の `/api/auth/*` を route interception でモックする。
 * web と API は別オリジン(NEXT_PUBLIC_API_URL)なので、fulfill するレスポンスにも
 * ブラウザの CORS 検証が効く。CORS ヘッダの付与と OPTIONS プリフライト処理が必須。
 */

// CORS の allow-origin はリクエストの Origin を反映する(ポート差し替えに追従)。
// 取得できない場合のフォールバックのみ既定ポートを使う。
const FALLBACK_ORIGIN = "http://127.0.0.1:3000";

function corsHeaders(origin: string) {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type, x-signup-intent",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  };
}

// 固定の ISO 文字列(テストの決定性のため new Date() は使わない)
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

interface MockOptions {
  /** 初期セッション(未ログインは null) */
  session?: SessionPayload;
  /** sign-in/email-otp を INVALID_OTP エラーにする */
  invalidOtp?: boolean;
}

/**
 * `/api/auth/*` をモックする。返り値の `state` は sign-in / sign-out で更新され、
 * 以降の get-session に反映される(ログイン→ログアウトの状態遷移を再現)。
 */
async function mockAuth(page: Page, opts: MockOptions = {}) {
  const state: { session: SessionPayload } = { session: opts.session ?? null };

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
    if (path.endsWith("/send-verification-otp")) {
      await json(200, { success: true });
      return;
    }
    if (path.endsWith("/sign-in/email-otp")) {
      if (opts.invalidOtp) {
        await json(400, { code: "INVALID_OTP", message: "invalid otp" });
        return;
      }
      const body = request.postDataJSON() as { email?: string; displayName?: string };
      const user = makeUser({
        ...(body.email ? { email: body.email } : {}),
        ...(body.displayName ? { displayName: body.displayName } : {}),
      });
      state.session = { session: makeSession(), user };
      await json(200, { token: "tok_1", user });
      return;
    }
    if (path.endsWith("/sign-in/social")) {
      await json(200, { url: `${origin}/dashboard`, redirect: true });
      return;
    }
    if (path.endsWith("/sign-out")) {
      state.session = null;
      await json(200, { success: true });
      return;
    }
    if (path.endsWith("/update-user")) {
      await json(200, { status: true });
      return;
    }
    // 未使用エンドポイントは空で返す(useSession 以外を壊さないため)
    await json(200, {});
  });

  return { state };
}

test.describe("認証フロー", () => {
  test("未認証で /dashboard にアクセスすると /login にリダイレクトする", async ({ page }) => {
    await mockAuth(page, { session: null });

    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
  });

  test("email OTP でログインすると /dashboard に遷移しユーザー情報が表示される", async ({ page }) => {
    await mockAuth(page, { session: null });

    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill("test@example.com");
    await page.getByRole("button", { name: "認証コードを送信" }).click();
    await page.getByLabel("認証コード").fill("123456");
    await page.getByRole("button", { name: "ログイン" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("test@example.com")).toBeVisible();
  });

  test("OTP が不正な場合はエラーを表示し遷移しない", async ({ page }) => {
    await mockAuth(page, { session: null, invalidOtp: true });

    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill("test@example.com");
    await page.getByRole("button", { name: "認証コードを送信" }).click();
    await page.getByLabel("認証コード").fill("000000");
    await page.getByRole("button", { name: "ログイン" }).click();

    await expect(
      page.getByText("コードが正しくありません。または有効期限が切れています。"),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("サインアップで signUp フラグと displayName が送信され /dashboard に遷移する", async ({
    page,
  }) => {
    await mockAuth(page, { session: null });

    await page.goto("/signup");
    await page.getByLabel("メールアドレス").fill("new@example.com");
    await page.getByLabel("表示名（任意）").fill("山田花子");
    await page.getByRole("button", { name: "認証コードを送信" }).click();
    await page.getByLabel("認証コード").fill("123456");

    const signInRequest = page.waitForRequest("**/sign-in/email-otp");
    await page.getByRole("button", { name: "登録する" }).click();
    const body = (await signInRequest).postDataJSON();

    expect(body).toMatchObject({ signUp: true, displayName: "山田花子" });
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("山田花子")).toBeVisible();
  });

  test("ログアウトすると /login に戻る", async ({ page }) => {
    await mockAuth(page, { session: { session: makeSession(), user: makeUser() } });

    await page.goto("/dashboard");
    await expect(page.getByText("test@example.com")).toBeVisible();

    await page.getByRole("button", { name: "アカウントメニュー" }).click();
    await page.getByRole("menuitem", { name: "ログアウト" }).click();

    await expect(page).toHaveURL(/\/login/);
  });

  test("Google ログインは web オリジンの callbackURL 付きで signIn.social を呼ぶ", async ({
    page,
  }) => {
    await mockAuth(page, { session: null });

    await page.goto("/login");
    const origin = new URL(page.url()).origin;
    const socialRequest = page.waitForRequest("**/sign-in/social");
    await page.getByRole("button", { name: "Google でログイン" }).click();
    const body = (await socialRequest).postDataJSON();

    expect(body).toMatchObject({
      provider: "google",
      callbackURL: `${origin}/dashboard`,
    });
  });
});
