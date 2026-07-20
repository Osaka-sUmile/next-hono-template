import { describe, expect, it, vi, beforeEach } from "vitest";
import * as Sentry from "@sentry/cloudflare";
import { createTestApp } from "../../test-utils";
import { ErrorCodes } from "../errors";
import type { Env } from "../../infrastructure";

vi.mock("@sentry/cloudflare", () => ({
  captureException: vi.fn(),
}));

vi.mock("../../infrastructure/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

const session = { user: { id: "user-1" }, session: { id: "sess-1" } };

// GET /api/v1/me で use case を失敗させ、onError(createErrorHandler) を経由させる。
function appThatThrows(message: string, envOverrides: Partial<Env> = {}) {
  return createTestApp({
    getSession: vi.fn().mockResolvedValue(session),
    execute: vi.fn().mockRejectedValue(new Error(message)),
    env: envOverrides,
  }).app;
}

describe("onError (createErrorHandler) via GET /api/v1/me", () => {
  beforeEach(() => {
    vi.mocked(Sentry.captureException).mockClear();
  });

  it("captures the error in Sentry and returns 500 with INTERNAL_ERROR", async () => {
    const res = await appThatThrows("boom", { NODE_ENV: "development" }).request(
      "/api/v1/me",
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "boom", code: ErrorCodes.INTERNAL_ERROR });
    expect(Sentry.captureException).toHaveBeenCalledOnce();
  });

  it("exposes err.message in development", async () => {
    const res = await appThatThrows("detailed dev message", {
      NODE_ENV: "development",
    }).request("/api/v1/me");

    expect(await res.json()).toEqual({
      error: "detailed dev message",
      code: ErrorCodes.INTERNAL_ERROR,
    });
  });

  it("hides err.message in production", async () => {
    const res = await appThatThrows("detailed dev message", {
      NODE_ENV: "production",
    }).request("/api/v1/me");

    expect(await res.json()).toEqual({
      error: "Internal Server Error",
      code: ErrorCodes.INTERNAL_ERROR,
    });
  });

  it("keeps an application-originated SyntaxError as 500 INTERNAL_ERROR and reports it", async () => {
    // 不正 JSON ボディ由来ではない SyntaxError（例: ユースケースが外部データを
    // JSON.parse して失敗）は想定外の障害として 500 + Sentry のまま扱う。
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(session),
      execute: vi.fn().mockRejectedValue(new SyntaxError("Unexpected token in app-internal data")),
      env: { NODE_ENV: "development" },
    });

    const res = await app.request("/api/v1/me");

    expect(res.status).toBe(500);
    // 必須キー `error`（文字列）と `code` の両方を検証する。
    expect(await res.json()).toEqual(
      expect.objectContaining({
        error: expect.any(String),
        code: ErrorCodes.INTERNAL_ERROR,
      }),
    );
    expect(Sentry.captureException).toHaveBeenCalledOnce();
  });
});
