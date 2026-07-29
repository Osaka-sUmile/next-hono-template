import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"
import {
  createAuthLimiter,
  createFeedbackSubmitLimiter,
} from "./rate-limit.middleware"
import { ErrorCodes } from "../errors"
import type { AppEnv } from "../app-env"
import type { AuthSession } from "./require-auth.middleware"

function buildTestApp() {
  const app = new Hono<AppEnv>()
  app.use("/protected", createAuthLimiter())
  app.get("/protected", (c) => c.json({ ok: true }))
  return app
}

function buildFeedbackTestApp() {
  const app = new Hono<AppEnv>()
  app.use("/protected", async (c, next) => {
    c.set("auth", {
      user: { id: c.req.header("x-test-user-id") ?? "user-1" },
      session: { id: "session-1" },
    } as AuthSession)
    await next()
  })
  app.use("/protected", createFeedbackSubmitLimiter())
  app.post("/protected", (c) => c.json({ ok: true }))
  return app
}

describe("createAuthLimiter", () => {
  it("skips rate limiting when the binding is not injected (local dev / unrelated tests)", async () => {
    const app = buildTestApp()

    const res = await app.request("/protected")

    expect(res.status).toBe(200)
  })

  it("passes the request through when the limiter reports success", async () => {
    const app = buildTestApp()
    const limit = vi.fn().mockResolvedValue({ success: true })

    const res = await app.request(
      "/protected",
      {},
      { AUTH_RATE_LIMITER: { limit } }
    )

    expect(res.status).toBe(200)
    expect(limit).toHaveBeenCalledWith({ key: "unknown" })
  })

  it("uses the cf-connecting-ip header as the limiter key", async () => {
    const app = buildTestApp()
    const limit = vi.fn().mockResolvedValue({ success: true })

    await app.request(
      "/protected",
      { headers: { "cf-connecting-ip": "203.0.113.1" } },
      { AUTH_RATE_LIMITER: { limit } }
    )

    expect(limit).toHaveBeenCalledWith({ key: "203.0.113.1" })
  })

  it("returns 429 RATE_LIMIT_EXCEEDED when the limiter reports failure", async () => {
    const app = buildTestApp()
    const limit = vi.fn().mockResolvedValue({ success: false })

    const res = await app.request(
      "/protected",
      {},
      { AUTH_RATE_LIMITER: { limit } }
    )

    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({
      error: "Too many requests",
      code: ErrorCodes.RATE_LIMIT_EXCEEDED,
    })
  })
})

describe("createFeedbackSubmitLimiter", () => {
  it("skips rate limiting when the binding is not injected", async () => {
    const app = buildFeedbackTestApp()

    const res = await app.request("/protected", { method: "POST" })

    expect(res.status).toBe(200)
  })

  it("uses the authenticated user id as the limiter key", async () => {
    const app = buildFeedbackTestApp()
    const limit = vi.fn().mockResolvedValue({ success: true })

    const res = await app.request(
      "/protected",
      {
        method: "POST",
        headers: {
          "cf-connecting-ip": "203.0.113.1",
          "x-test-user-id": "user-123",
        },
      },
      { FEEDBACK_SUBMIT_RATE_LIMITER: { limit } }
    )

    expect(res.status).toBe(200)
    expect(limit).toHaveBeenCalledWith({ key: "user-123" })
  })

  it("returns 429 RATE_LIMIT_EXCEEDED when the limiter reports failure", async () => {
    const app = buildFeedbackTestApp()
    const limit = vi.fn().mockResolvedValue({ success: false })

    const res = await app.request(
      "/protected",
      { method: "POST" },
      { FEEDBACK_SUBMIT_RATE_LIMITER: { limit } }
    )

    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({
      error: "Too many requests",
      code: ErrorCodes.RATE_LIMIT_EXCEEDED,
    })
  })

  it("counts different authenticated users independently", async () => {
    const app = buildFeedbackTestApp()
    const seenKeys = new Set<string>()
    const limit = vi.fn(async ({ key }: { key: string }) => {
      const success = !seenKeys.has(key)
      seenKeys.add(key)
      return { success }
    })
    const env = { FEEDBACK_SUBMIT_RATE_LIMITER: { limit } }

    const firstUserResponse = await app.request(
      "/protected",
      { method: "POST", headers: { "x-test-user-id": "user-a" } },
      env
    )
    const secondUserResponse = await app.request(
      "/protected",
      { method: "POST", headers: { "x-test-user-id": "user-b" } },
      env
    )
    const repeatedFirstUserResponse = await app.request(
      "/protected",
      { method: "POST", headers: { "x-test-user-id": "user-a" } },
      env
    )

    expect(firstUserResponse.status).toBe(200)
    expect(secondUserResponse.status).toBe(200)
    expect(repeatedFirstUserResponse.status).toBe(429)
    expect(limit.mock.calls.map(([options]) => options)).toEqual([
      { key: "user-a" },
      { key: "user-b" },
      { key: "user-a" },
    ])
  })
})
