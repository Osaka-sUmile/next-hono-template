import { describe, expect, it, vi, beforeEach } from "vitest";
import * as Sentry from "@sentry/node";
import { createTestApp } from "../../test-utils";
import { ErrorCodes } from "../error-codes";

vi.mock("@sentry/node", () => ({
  captureException: vi.fn(),
}));

const mockEnv = {
  NODE_ENV: "development" as "development" | "test" | "production",
  WEB_BASE_URL: "http://localhost:3000",
};

vi.mock("../../infrastructure/env", () => ({
  get env() {
    return mockEnv;
  },
}));

vi.mock("../../infrastructure/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

const session = { user: { id: "user-1" }, session: { id: "sess-1" } };

// GET /api/v1/me で use case を失敗させ、onError(createErrorHandler) を経由させる。
function appThatThrows(message: string) {
  return createTestApp({
    getSession: vi.fn().mockResolvedValue(session),
    execute: vi.fn().mockRejectedValue(new Error(message)),
  }).app;
}

describe("onError (createErrorHandler) via GET /api/v1/me", () => {
  beforeEach(() => {
    mockEnv.NODE_ENV = "development";
    vi.mocked(Sentry.captureException).mockClear();
  });

  it("captures the error in Sentry and returns 500 with INTERNAL_ERROR", async () => {
    const res = await appThatThrows("boom").request("/api/v1/me");

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "boom", code: ErrorCodes.INTERNAL_ERROR });
    expect(Sentry.captureException).toHaveBeenCalledOnce();
  });

  it("exposes err.message in development", async () => {
    mockEnv.NODE_ENV = "development";

    const res = await appThatThrows("detailed dev message").request("/api/v1/me");

    expect(await res.json()).toEqual({
      error: "detailed dev message",
      code: ErrorCodes.INTERNAL_ERROR,
    });
  });

  it("hides err.message in production", async () => {
    mockEnv.NODE_ENV = "production";

    const res = await appThatThrows("detailed dev message").request("/api/v1/me");

    expect(await res.json()).toEqual({
      error: "Internal Server Error",
      code: ErrorCodes.INTERNAL_ERROR,
    });
  });
});
