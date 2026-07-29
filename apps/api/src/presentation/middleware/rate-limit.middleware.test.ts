import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"
import { createAuthLimiter } from "./rate-limit.middleware"
import { ErrorCodes } from "../errors"
import type { WorkerRateLimitBindings } from "../../infrastructure"

function buildTestApp() {
  const app = new Hono<{ Bindings: WorkerRateLimitBindings }>()
  app.use("/protected", createAuthLimiter())
  app.get("/protected", (c) => c.json({ ok: true }))
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
