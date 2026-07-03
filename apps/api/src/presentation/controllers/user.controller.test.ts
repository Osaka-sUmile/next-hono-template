import { describe, expect, it, vi } from "vitest";
import type { UserResponseDto } from "../../application";
import { createTestApp } from "../../test-utils";
import { ErrorCodes } from "../error-codes";

vi.mock("../../infrastructure/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

const session = { user: { id: "user-1" }, session: { id: "sess-1" } };

describe("GET /api/v1/me", () => {
  it("returns 200 with user data and the v1 private cache header", async () => {
    const user: UserResponseDto = {
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
      role: "user",
      displayName: null,
      image: null,
      emailVerified: false,
      createdAt: new Date("2024-01-01"),
    };
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(session),
      execute: vi.fn().mockResolvedValue(user),
    });

    const res = await app.request("/api/v1/me");

    expect(res.status).toBe(200);
    // Date は JSON 化で ISO 文字列になるため、シリアライズ後の形と比較する。
    expect(await res.json()).toEqual(JSON.parse(JSON.stringify(user)));
    expect(res.headers.get("Cache-Control")).toBe(
      "private, no-cache, no-store, must-revalidate",
    );
  });

  it("returns 500 via onError when user is not found despite a valid session", async () => {
    // 自前で 500 を返さず例外を伝播し、中央ハンドラ→Sentry に乗せる。
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(session),
      execute: vi.fn().mockResolvedValue(null),
    });

    const res = await app.request("/api/v1/me");

    expect(res.status).toBe(500);
    expect((await res.json<{ code: string }>()).code).toBe(ErrorCodes.INTERNAL_ERROR);
  });

  it("returns 500 via onError when the use case throws", async () => {
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(session),
      execute: vi.fn().mockRejectedValue(new Error("Unexpected error")),
    });

    const res = await app.request("/api/v1/me");

    expect(res.status).toBe(500);
    expect((await res.json<{ code: string }>()).code).toBe(ErrorCodes.INTERNAL_ERROR);
  });
});
