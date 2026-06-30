import { describe, expect, it, vi } from "vitest";
import { createTestApp } from "../../test-utils";
import { ErrorCodes } from "../error-codes";

vi.mock("../../infrastructure/env", () => ({
  env: { NODE_ENV: "test", WEB_BASE_URL: "http://localhost:3000" },
}));

vi.mock("../../infrastructure/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

const validSession = { user: { id: "123" }, session: { id: "sess-1" } };

describe("requireAuth (via GET /api/v1/me)", () => {
  it("returns 401 SESSION_INVALID when the session is null", async () => {
    const { app } = createTestApp({ getSession: vi.fn().mockResolvedValue(null) });

    const res = await app.request("/api/v1/me");

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: "Unauthorized",
      code: ErrorCodes.SESSION_INVALID,
    });
  });

  it("passes auth through and returns the user when a session exists", async () => {
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(validSession),
      execute: vi.fn().mockResolvedValue({ id: "123" }),
    });

    const res = await app.request("/api/v1/me");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "123" });
  });

  it("delegates an unexpected getSession error to onError (500)", async () => {
    const { app } = createTestApp({
      getSession: vi.fn().mockRejectedValue(new Error("Server error")),
    });

    const res = await app.request("/api/v1/me");

    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe(ErrorCodes.INTERNAL_ERROR);
  });

  it("returns 401 SESSION_EXPIRED when better-auth throws 401 with SESSION_EXPIRED", async () => {
    const err = Object.assign(new Error("session expired"), {
      statusCode: 401,
      body: { code: "SESSION_EXPIRED" },
    });
    const { app } = createTestApp({ getSession: vi.fn().mockRejectedValue(err) });

    const res = await app.request("/api/v1/me");

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: "Session expired",
      code: ErrorCodes.SESSION_EXPIRED,
    });
  });

  it("returns 401 SESSION_INVALID when better-auth throws 401 without SESSION_EXPIRED", async () => {
    const err = Object.assign(new Error("invalid token"), {
      statusCode: 401,
      body: { code: "INVALID_TOKEN" },
    });
    const { app } = createTestApp({ getSession: vi.fn().mockRejectedValue(err) });

    const res = await app.request("/api/v1/me");

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: "Unauthorized",
      code: ErrorCodes.SESSION_INVALID,
    });
  });
});
