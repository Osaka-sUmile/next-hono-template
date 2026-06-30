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
    // app.request() 経由など接続情報が無い文脈では getConnInfo が throw しうるため、
    // その場合は "unknown" に退避して 500 を出さない。
    keyGenerator: (c) => {
      try {
        return getConnInfo(c).remote.address ?? "unknown";
      } catch {
        return "unknown";
      }
    },
    handler: (c) =>
      c.json({ error: "Too many requests", code: ErrorCodes.RATE_LIMIT_EXCEEDED }, 429),
  });
}
