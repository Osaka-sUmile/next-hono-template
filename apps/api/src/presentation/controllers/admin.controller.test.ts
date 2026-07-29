import { describe, expect, it, vi } from "vitest"
import { createTestApp } from "../../test-utils"
import { ErrorCodes } from "../errors"

const adminSession = {
  user: { id: "admin-1", role: "admin" },
  session: { id: "sess-1" },
}
const userSession = {
  user: { id: "user-1", role: "user" },
  session: { id: "sess-2" },
}

describe("GET /api/v1/admin/users", () => {
  it("returns 200 with users for an authenticated admin", async () => {
    const users = [
      {
        id: "user-1",
        email: "user@example.com",
        name: "User",
        role: "user" as const,
        displayName: null,
        image: null,
        emailVerified: true,
        createdAt: new Date("2024-01-01"),
      },
    ]
    const { app, listUsers } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      listUsers: vi.fn().mockResolvedValue(users),
    })

    const res = await app.request("/api/v1/admin/users")

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(JSON.parse(JSON.stringify(users)))
    expect(listUsers).toHaveBeenCalledOnce()
  })

  it("returns 401 without a session and does not query users", async () => {
    const { app, listUsers } = createTestApp({
      getSession: vi.fn().mockResolvedValue(null),
    })

    const res = await app.request("/api/v1/admin/users")

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({
      error: "Unauthorized",
      code: ErrorCodes.SESSION_INVALID,
    })
    expect(listUsers).not.toHaveBeenCalled()
  })

  it("returns 403 for a non-admin user and does not query users", async () => {
    const { app, listUsers } = createTestApp({
      getSession: vi.fn().mockResolvedValue(userSession),
    })

    const res = await app.request("/api/v1/admin/users")

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      error: "Forbidden",
      code: ErrorCodes.FORBIDDEN,
    })
    expect(listUsers).not.toHaveBeenCalled()
  })
})

/**
 * Hono のパス指定は完全一致なので、v1.use("/admin/users", ...) では
 * "/admin/users/{userId}/role" のようなネストしたルートがガードから漏れる。
 * create-app が "/admin/*" でまとめて守っていることを、まだ実装していない
 * パスに対しても 401/403 が返ることで固定する（漏れていれば 404 になる）。
 */
describe("/api/v1/admin/* のガード", () => {
  const nestedPaths = [
    "/api/v1/admin/users/user-1/role",
    "/api/v1/admin/feedback/surveys/survey-1/questions",
    "/api/v1/admin/anything",
  ]

  it.each(nestedPaths)("returns 401 for %s without a session", async (path) => {
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(null),
    })

    const res = await app.request(path)

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({
      error: "Unauthorized",
      code: ErrorCodes.SESSION_INVALID,
    })
  })

  it.each(nestedPaths)(
    "returns 403 for %s with a non-admin session",
    async (path) => {
      const { app } = createTestApp({
        getSession: vi.fn().mockResolvedValue(userSession),
      })

      const res = await app.request(path)

      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({
        error: "Forbidden",
        code: ErrorCodes.FORBIDDEN,
      })
    }
  )

  // GET 以外でもガードが効くことを確認する。書き込み系ルート (PR6) が
  // 追加されたときに無防備で出荷されないようにするための回帰テスト。
  it("returns 403 for a PATCH to a nested admin path with a non-admin session", async () => {
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(userSession),
    })

    const res = await app.request("/api/v1/admin/users/user-1/role", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "admin" }),
    })

    expect(res.status).toBe(403)
  })
})
