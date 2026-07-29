import { describe, expect, it, vi } from "vitest"
import { CannotChangeOwnRoleError, UserNotFoundError } from "../../application"
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

describe("GET /api/v1/admin/summary", () => {
  it("returns 200 with KPI summary for an authenticated admin", async () => {
    const summary = {
      userCount: 12,
      adminCount: 2,
      surveyCount: 4,
      activeSurveyCount: 1,
      submissionCount: 30,
      submissionCountLast7Days: 8,
    }
    const { app, getAdminSummary } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      getAdminSummary: vi.fn().mockResolvedValue(summary),
    })

    const res = await app.request("/api/v1/admin/summary")

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(summary)
    expect(getAdminSummary).toHaveBeenCalledOnce()
  })

  it("returns 401 without a session and does not query the summary", async () => {
    const { app, getAdminSummary } = createTestApp({
      getSession: vi.fn().mockResolvedValue(null),
    })

    const res = await app.request("/api/v1/admin/summary")

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({
      error: "Unauthorized",
      code: ErrorCodes.SESSION_INVALID,
    })
    expect(getAdminSummary).not.toHaveBeenCalled()
  })

  it("returns 403 for a non-admin user and does not query the summary", async () => {
    const { app, getAdminSummary } = createTestApp({
      getSession: vi.fn().mockResolvedValue(userSession),
    })

    const res = await app.request("/api/v1/admin/summary")

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      error: "Forbidden",
      code: ErrorCodes.FORBIDDEN,
    })
    expect(getAdminSummary).not.toHaveBeenCalled()
  })
})

describe("GET /api/v1/admin/users", () => {
  it("returns 200 with users for an authenticated admin", async () => {
    const result = {
      items: [
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
      ],
      total: 1,
      limit: 10,
      offset: 5,
    }
    const { app, listUsers } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      listUsers: vi.fn().mockResolvedValue(result),
    })

    const res = await app.request(
      "/api/v1/admin/users?limit=10&offset=5&search=%20USER%20&role=user"
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(JSON.parse(JSON.stringify(result)))
    expect(listUsers).toHaveBeenCalledWith({
      limit: 10,
      offset: 5,
      search: "USER",
      role: "user",
    })
  })

  it("uses paging defaults and omits optional filters", async () => {
    const { app, listUsers } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      listUsers: vi
        .fn()
        .mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 }),
    })

    const res = await app.request("/api/v1/admin/users")

    expect(res.status).toBe(200)
    expect(listUsers).toHaveBeenCalledWith({ limit: 20, offset: 0 })
  })

  it.each(["limit=0", "limit=101"])(
    "returns 400 for invalid paging query %s",
    async (query) => {
      const { app, listUsers } = createTestApp({
        getSession: vi.fn().mockResolvedValue(adminSession),
      })

      const res = await app.request(`/api/v1/admin/users?${query}`)

      expect(res.status).toBe(400)
      expect(listUsers).not.toHaveBeenCalled()
    }
  )

  it("returns 400 for an unsupported role", async () => {
    const { app, listUsers } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
    })

    const res = await app.request("/api/v1/admin/users?role=owner")

    expect(res.status).toBe(400)
    expect(listUsers).not.toHaveBeenCalled()
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

describe("PATCH /api/v1/admin/users/{userId}/role", () => {
  const updatedUser = {
    id: "user-1",
    email: "user@example.com",
    name: "User",
    role: "admin" as const,
    displayName: null,
  }

  function patchRole(userId: string, body: unknown): Request {
    return new Request(`http://localhost/api/v1/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  }

  it("returns 200 and changes another user's role using the session user as actor", async () => {
    const { app, changeUserRole } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      changeUserRole: vi.fn().mockResolvedValue(updatedUser),
    })

    const res = await app.request(patchRole("user-1", { role: "admin" }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(updatedUser)
    expect(changeUserRole).toHaveBeenCalledWith({
      actorUserId: "admin-1",
      targetUserId: "user-1",
      role: "admin",
    })
  })

  it.each([
    ["an unsupported role", { role: "owner" }],
    ["an empty body", {}],
    ["an unknown key", { role: "admin", userId: "victim-1" }],
  ])("returns 400 for %s", async (_label, body) => {
    const { app, changeUserRole } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
    })

    const res = await app.request(patchRole("user-1", body))

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      code: ErrorCodes.VALIDATION_ERROR,
    })
    expect(changeUserRole).not.toHaveBeenCalled()
  })

  it("returns 400 for a userId longer than 64 characters", async () => {
    const { app, changeUserRole } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
    })

    const res = await app.request(patchRole("x".repeat(65), { role: "admin" }))

    expect(res.status).toBe(400)
    expect(changeUserRole).not.toHaveBeenCalled()
  })

  it("returns 401 without a session", async () => {
    const { app, changeUserRole } = createTestApp({
      getSession: vi.fn().mockResolvedValue(null),
    })

    const res = await app.request(patchRole("user-1", { role: "admin" }))

    expect(res.status).toBe(401)
    expect(changeUserRole).not.toHaveBeenCalled()
  })

  it("returns 403 for a non-admin user", async () => {
    const { app, changeUserRole } = createTestApp({
      getSession: vi.fn().mockResolvedValue(userSession),
    })

    const res = await app.request(patchRole("user-1", { role: "admin" }))

    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: ErrorCodes.FORBIDDEN })
    expect(changeUserRole).not.toHaveBeenCalled()
  })

  it("returns 403 CANNOT_CHANGE_OWN_ROLE for a self change", async () => {
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      changeUserRole: vi
        .fn()
        .mockRejectedValue(new CannotChangeOwnRoleError("admin-1")),
    })

    const res = await app.request(patchRole("admin-1", { role: "user" }))

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      error: 'A user cannot change their own role: userId="admin-1"',
      code: ErrorCodes.CANNOT_CHANGE_OWN_ROLE,
    })
  })

  it("returns 404 USER_NOT_FOUND for an unknown target", async () => {
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      changeUserRole: vi
        .fn()
        .mockRejectedValue(new UserNotFoundError("missing-user")),
    })

    const res = await app.request(patchRole("missing-user", { role: "admin" }))

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({
      error: 'User not found: userId="missing-user"',
      code: ErrorCodes.USER_NOT_FOUND,
    })
  })

  it("delegates unexpected errors to the central 500 handler", async () => {
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      changeUserRole: vi.fn().mockRejectedValue(new Error("database down")),
    })

    const res = await app.request(patchRole("user-1", { role: "admin" }))

    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ code: ErrorCodes.INTERNAL_ERROR })
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
