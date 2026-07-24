import { describe, expect, it, vi } from "vitest";
import { createTestApp } from "../../test-utils";
import { ErrorCodes } from "../errors";

vi.mock("../../infrastructure/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

const adminSession = { user: { id: "admin-1", role: "admin" }, session: { id: "sess-1" } };
const userSession = { user: { id: "user-1", role: "user" }, session: { id: "sess-2" } };

describe("requireAdmin (via GET /api/v1/admin/users)", () => {
  it("returns 200 with the user list when the session role is admin", async () => {
    const users = [{ id: "user-1", role: "user" }];
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      listUsers: vi.fn().mockResolvedValue(users),
    });

    const res = await app.request("/api/v1/admin/users");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(users);
  });

  it("returns 403 FORBIDDEN when the session role is not admin", async () => {
    const listUsers = vi.fn();
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(userSession),
      listUsers,
    });

    const res = await app.request("/api/v1/admin/users");

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden", code: ErrorCodes.FORBIDDEN });
    // 認可で弾かれた場合はユースケースを実行しない。
    expect(listUsers).not.toHaveBeenCalled();
  });

  it("returns 401 SESSION_INVALID when there is no session (requireAuth blocks first)", async () => {
    const { app } = createTestApp({ getSession: vi.fn().mockResolvedValue(null) });

    const res = await app.request("/api/v1/admin/users");

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized", code: ErrorCodes.SESSION_INVALID });
  });
});
