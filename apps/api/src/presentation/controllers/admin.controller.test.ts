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
