import { describe, expect, it, vi } from "vitest";
import { createTestApp } from "../../test-utils";

const adminSession = { user: { id: "admin-1", role: "admin" }, session: { id: "sess-1" } };

describe("GET /api/v1/admin/users", () => {
  it("returns 200 with users for an authenticated admin", async () => {
    const users = [{
      id: "user-1", email: "user@example.com", name: "User", role: "user" as const,
      displayName: null, image: null, emailVerified: true, createdAt: new Date("2024-01-01"),
    }];
    const { app, listUsers } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      listUsers: vi.fn().mockResolvedValue(users),
    });

    const res = await app.request("/api/v1/admin/users");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(JSON.parse(JSON.stringify(users)));
    expect(listUsers).toHaveBeenCalledOnce();
  });
});
