import type { MiddlewareHandler } from "hono";
import type { WorkerRateLimitBindings } from "../../infrastructure";
import { ErrorCodes } from "../errors";
import { errorResponse } from "../http";

type AuthLimiterEnv = { Bindings: WorkerRateLimitBindings };

/**
 * 認証系エンドポイント(email OTP 送信・サインイン・パスワードリセット)向けのレートリミッター。
 * Cloudflare Workers Rate Limiting binding を使い、wrangler.jsonc の設定(60 秒間に 10 リクエスト)
 * を上限とする。超過時は 429 で RATE_LIMIT_EXCEEDED を返す。
 *
 * binding は colo 単位の eventual consistent な近似カウントであり、in-memory store と異なり
 * 複数インスタンス間でも共有される(issue #41)。
 * ローカルテスト等で binding が未注入の場合はレート制限をスキップする。
 */
export function createAuthLimiter(): MiddlewareHandler<AuthLimiterEnv> {
  return async (c, next) => {
    const limiter = c.env?.AUTH_RATE_LIMITER;
    if (!limiter) {
      await next();
      return;
    }

    const key = c.req.header("cf-connecting-ip") ?? "unknown";
    const { success } = await limiter.limit({ key });
    if (!success) {
      return errorResponse(c, 429, ErrorCodes.RATE_LIMIT_EXCEEDED, "Too many requests");
    }

    await next();
  };
}
