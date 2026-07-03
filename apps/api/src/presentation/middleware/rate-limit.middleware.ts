import { rateLimiter } from "hono-rate-limiter";
import type { MiddlewareHandler } from "hono";
import { ErrorCodes } from "../error-codes";

/**
 * 認証系エンドポイント (/api/auth) 向けのレートリミッターを生成する。
 * 15 分間に 20 リクエストを上限とし、超過時は 429 で RATE_LIMIT_EXCEEDED を返す。
 *
 * 制約: in-memory store のため isolate ごとに状態が分離され、
 * Cloudflare Workers では複数 isolate 間でカウントが共有されない
 * （同一クライアントでも isolate が変われば上限がリセットされうる）。
 * 恒久対応は Durable Objects 等への置き換えを issue #41 / #52 で追跡中。
 */
export function createAuthLimiter(): MiddlewareHandler {
  return rateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-6",
    // クライアント IP をキーにする。Cloudflare Workers では cf-connecting-ip ヘッダーで取得する。
    keyGenerator: (c) => c.req.header("cf-connecting-ip") ?? "unknown",
    handler: (c) =>
      c.json({ error: "Too many requests", code: ErrorCodes.RATE_LIMIT_EXCEEDED }, 429),
  });
}
