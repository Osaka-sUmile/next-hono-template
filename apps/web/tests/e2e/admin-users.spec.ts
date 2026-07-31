import { expect, test, type Page } from "@playwright/test"

/**
 * 管理エリアのユーザー一覧(/admin/users)の e2e。
 *
 * admin.spec.ts と同様、API/DB は立てず `/api/auth/*` と `/api/v1/admin/**` を
 * route interception でモックする。web と API は別オリジンなので CORS ヘッダの
 * 付与と OPTIONS プリフライト処理(PATCH はプリフライトが必ず飛ぶ)が必須。
 */

const FALLBACK_ORIGIN = "http://127.0.0.1:3000"

function corsHeaders(origin: string) {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers":
      "content-type, x-signup-intent, x-captcha-response",
    "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
  }
}

const NOW = "2026-07-15T00:00:00.000Z"
const EXPIRES = "2026-07-22T00:00:00.000Z"

const ADMIN_SESSION = {
  session: {
    id: "sess_1",
    token: "tok_1",
    userId: "user_1",
    expiresAt: EXPIRES,
    createdAt: NOW,
    updatedAt: NOW,
    ipAddress: "",
    userAgent: "",
  },
  user: {
    id: "user_1",
    email: "admin@example.com",
    emailVerified: true,
    name: "管理 太郎",
    image: null,
    createdAt: NOW,
    updatedAt: NOW,
    role: "admin",
    displayName: "管理者",
  },
}

type MockUser = {
  id: string
  email: string
  name: string
  role: string
  displayName: string | null
  image: string | null
  emailVerified: boolean
}

function makeUsers(): MockUser[] {
  return [
    {
      id: "user_1",
      email: "admin@example.com",
      name: "管理 太郎",
      role: "admin",
      displayName: "管理者",
      image: null,
      emailVerified: true,
    },
    {
      id: "user_2",
      email: "member@example.com",
      name: "会員 花子",
      role: "user",
      displayName: "はなこ",
      image: null,
      emailVerified: true,
    },
  ]
}

/**
 * 認証済み admin セッションと、in-memory のユーザーストアに対する
 * GET /admin/users・PATCH /admin/users/{id}/role をモックする。
 * PATCH はストアを書き換えるため、直後の GET には変更後の role が反映される。
 */
async function mockUsersFlow(page: Page, users: MockUser[]) {
  const patchBodies: unknown[] = []

  await page.route("**/api/auth/**", async (route) => {
    const request = route.request()
    const origin = request.headers()["origin"] ?? FALLBACK_ORIGIN
    const cors = corsHeaders(origin)

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors })
      return
    }

    const path = new URL(request.url()).pathname
    const body = path.endsWith("/get-session") ? ADMIN_SESSION : {}
    await route.fulfill({
      status: 200,
      headers: { ...cors, "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  })

  await page.route("**/api/v1/admin/**", async (route) => {
    const request = route.request()
    const origin = request.headers()["origin"] ?? FALLBACK_ORIGIN
    const cors = corsHeaders(origin)

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors })
      return
    }

    const url = new URL(request.url())
    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        headers: { ...cors, "content-type": "application/json" },
        body: JSON.stringify(body),
      })

    const roleMatch = /\/admin\/users\/([^/]+)\/role$/.exec(url.pathname)
    if (roleMatch && request.method() === "PATCH") {
      const target = users.find((user) => user.id === roleMatch[1])
      if (!target) {
        await json(404, { error: "User not found", code: "USER_NOT_FOUND" })
        return
      }
      const body = request.postDataJSON() as { role: string }
      patchBodies.push(body)
      target.role = body.role
      await json(200, {
        id: target.id,
        email: target.email,
        name: target.name,
        role: target.role,
        displayName: target.displayName,
      })
      return
    }

    if (url.pathname.endsWith("/admin/users")) {
      const search = url.searchParams.get("search")?.toLowerCase()
      const role = url.searchParams.get("role")
      const limit = Number(url.searchParams.get("limit") ?? 20)
      const offset = Number(url.searchParams.get("offset") ?? 0)
      const filtered = users.filter((user) => {
        if (role !== null && user.role !== role) return false
        if (search !== undefined) {
          const haystack = [user.email, user.name, user.displayName ?? ""]
          if (!haystack.some((v) => v.toLowerCase().includes(search)))
            return false
        }
        return true
      })
      await json(200, {
        items: filtered.slice(offset, offset + limit),
        total: filtered.length,
        limit,
        offset,
      })
      return
    }

    await json(404, { error: "Not Found", code: "NOT_FOUND" })
  })

  return { patchBodies }
}

test.describe("管理エリア ユーザー一覧", () => {
  test("一覧が表示され、自分の行のロール変更は無効になっている", async ({
    page,
  }) => {
    await mockUsersFlow(page, makeUsers())

    await page.goto("/admin/users")

    const selfRow = page.getByRole("row", { name: /admin@example\.com/ })
    await expect(selfRow.getByText("自分")).toBeVisible()
    await expect(
      selfRow.getByRole("combobox", { name: "admin@example.com のロール" })
    ).toBeDisabled()

    // 「一般」はロール変更 Select のトリガーにも現れるため、バッジに限定して探す
    const memberRow = page.getByRole("row", { name: /member@example\.com/ })
    await expect(
      memberRow.locator("[data-slot='badge']", { hasText: "一般" })
    ).toBeVisible()
    await expect(page.getByText("1–2 / 2 件")).toBeVisible()
  })

  test("他ユーザーの role を変更すると PATCH が飛び、行が更新される", async ({
    page,
  }) => {
    const { patchBodies } = await mockUsersFlow(page, makeUsers())

    await page.goto("/admin/users")

    const memberRow = page.getByRole("row", { name: /member@example\.com/ })
    await memberRow
      .getByRole("combobox", { name: "member@example.com のロール" })
      .click()
    await page.getByRole("option", { name: "管理者" }).click()

    // PATCH body の検証
    await expect.poll(() => patchBodies).toEqual([{ role: "admin" }])

    // reload 後の行にバッジとして反映される
    await expect(
      page
        .getByRole("row", { name: /member@example\.com/ })
        .locator("[data-slot='badge']", { hasText: "管理者" })
    ).toBeVisible()
  })

  test("検索でヒットしないユーザーは行から消える", async ({ page }) => {
    await mockUsersFlow(page, makeUsers())

    await page.goto("/admin/users")
    await expect(page.getByText("member@example.com")).toBeVisible()

    await page.getByRole("searchbox", { name: "ユーザーを検索" }).fill("花子")

    await expect(page.getByText("member@example.com")).toBeVisible()
    await expect(page.getByText("admin@example.com")).toBeHidden()
    await expect(page.getByText("1–1 / 1 件")).toBeVisible()
  })
})
