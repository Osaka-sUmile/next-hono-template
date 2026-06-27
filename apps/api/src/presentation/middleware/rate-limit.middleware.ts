import { rateLimit, type RateLimitRequestHandler } from "express-rate-limit";
import { ErrorCodes } from "../error-codes";

/**
 * 認証系エンドポイント (/api/auth) 向けのレートリミッターを生成する。
 * 15 分間に 20 リクエストを上限とし、超過時は 429 で RATE_LIMIT_EXCEEDED を返す。
 */
export function createAuthLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests", code: ErrorCodes.RATE_LIMIT_EXCEEDED },
  });
}
