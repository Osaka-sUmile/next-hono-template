import { rateLimiter } from "hono-rate-limiter";
import { getConnInfo } from "@hono/node-server/conninfo";
import type { MiddlewareHandler } from "hono";
import { ErrorCodes } from "../error-codes";

/**
 * 認証系エンドポイント (/api/auth) 向けのレートリミッターを生成する。
 * 15 分間に 20 リクエストを上限とし、超過時は 429 で RATE_LIMIT_EXCEEDED を返す。
 */
export function createAuthLimiter(): MiddlewareHandler {
  return rateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-6",
    // クライアント IP をキーにする。Node ランタイムでは getConnInfo で取得する。
    keyGenerator: (c) => getConnInfo(c).remote.address ?? "unknown",
    handler: (c) =>
      c.json({ error: "Too many requests", code: ErrorCodes.RATE_LIMIT_EXCEEDED }, 429),
  });
}
