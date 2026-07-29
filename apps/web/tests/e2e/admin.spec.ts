import { expect, test, type Page } from "@playwright/test"

/**
 * 管理エリア(/admin)のシェルとガードの e2e。
 *
 * CI では web を `next start` で単体起動するだけで API/DB は立てないため、
 * better-auth の `/api/auth/*` と REST の `/api/v1/admin/**` を route interception でモックする。
 * web と API は別オリジン(NEXT_PUBLIC_API_URL)なので、fulfill するレスポンスにも
 * ブラウザの CORS 検証が効く。CORS ヘッダの付与と OPTIONS プリフライト処理が必須。
 */

const FALLBACK_ORIGIN = "http://127.0.0.1:3000"

function corsHeaders(origin: string, methods = "GET,POST,OPTIONS") {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers":
      "content-type, x-signup-intent, x-captcha-response",
    "access-control-allow-methods": methods,
  }
}

const NOW = "2026-07-15T00:00:00.000Z"
const EXPIRES = "2026-07-22T00:00:00.000Z"

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
  }
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
  }
}

const SUMMARY = {
  userCount: 42,
  adminCount: 3,
  surveyCount: 4,
  activeSurveyCount: 1,
  submissionCount: 128,
  submissionCountLast7Days: 17,
}

type SessionPayload = { session: object; user: object } | null

/**
 * `/api/auth/*` と `/api/v1/admin/**` をモックする。
 * session に null を渡すと未認証状態になる。
 */
async function mockAdminFlow(page: Page, session: SessionPayload) {
  await page.route("**/api/auth/**", async (route) => {
    const request = route.request()
    const origin = request.headers()["origin"] ?? FALLBACK_ORIGIN
    const cors = corsHeaders(origin)

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors })
      return
    }

    const path = new URL(request.url()).pathname
    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        headers: { ...cors, "content-type": "application/json" },
        body: JSON.stringify(body),
      })

    if (path.endsWith("/get-session")) {
      await json(200, session)
      return
    }
    await json(200, {})
  })

  await page.route("**/api/v1/admin/**", async (route) => {
    const request = route.request()
    const origin = request.headers()["origin"] ?? FALLBACK_ORIGIN
    const cors = corsHeaders(origin)

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors })
      return
    }

    const path = new URL(request.url()).pathname
    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        headers: { ...cors, "content-type": "application/json" },
        body: JSON.stringify(body),
      })

    // 実 API 同様、非 admin セッションには 403 を返す
    const role = (session?.user as { role?: string } | undefined)?.role
    if (role !== "admin") {
      await json(403, { error: "Forbidden", code: "FORBIDDEN" })
      return
    }

    if (path.endsWith("/admin/summary")) {
      await json(200, SUMMARY)
      return
    }
    await json(404, { error: "Not Found", code: "NOT_FOUND" })
  })
}

test.describe("管理エリア", () => {
  test("admin は /admin に到達でき、KPI カードが表示される", async ({
    page,
  }) => {
    await mockAdminFlow(page, {
      session: makeSession(),
      user: makeUser({ role: "admin" }),
    })

    await page.goto("/admin")

    // サイドバーとヘッダー(シェル)
    await expect(page.getByRole("link", { name: "ユーザー" })).toBeVisible()
    await expect(page.getByRole("link", { name: "アンケート" })).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "ダッシュボード" })
    ).toBeVisible()

    // KPI カード
    await expect(page.getByText("ユーザー数")).toBeVisible()
    await expect(page.getByText("42", { exact: true })).toBeVisible()
    await expect(page.getByText("直近7日の回答数")).toBeVisible()
    await expect(page.getByText("17", { exact: true })).toBeVisible()
  })

  test("一般ユーザーが /admin を開くと 403 パネルが表示される", async ({
    page,
  }) => {
    await mockAdminFlow(page, {
      session: makeSession(),
      user: makeUser({ role: "user" }),
    })

    await page.goto("/admin")

    await expect(page.getByText("アクセス権限がありません")).toBeVisible()
    await expect(
      page.getByRole("link", { name: "ダッシュボードへ戻る" })
    ).toBeVisible()
    // シェル(サイドバー)は見せない
    await expect(page.getByRole("link", { name: "ユーザー" })).toBeHidden()
  })

  test("未認証で /admin を開くと /login にリダイレクトされる", async ({
    page,
  }) => {
    await mockAdminFlow(page, null)

    await page.goto("/admin")

    await page.waitForURL("**/login")
    await expect(page).toHaveURL(/\/login$/)
  })
})
