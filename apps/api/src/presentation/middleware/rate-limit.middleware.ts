import type { MiddlewareHandler } from "hono"
import type { AppEnv } from "../app-env"
import { ErrorCodes } from "../errors"
import { errorResponse } from "../http"

/**
 * 認証系エンドポイント(email OTP 送信・サインイン・パスワードリセット)向けのレートリミッター。
 * Cloudflare Workers Rate Limiting binding を使い、wrangler.jsonc の設定(60 秒間に 10 リクエスト)
 * を上限とする。超過時は 429 で RATE_LIMIT_EXCEEDED を返す。
 *
 * binding は colo 単位の eventual consistent な近似カウントであり、in-memory store と異なり
 * 複数インスタンス間でも共有される(issue #41)。
 * ローカルテスト等で binding が未注入の場合はレート制限をスキップする。
 */
export function createAuthLimiter(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const limiter = c.env?.AUTH_RATE_LIMITER
    if (!limiter) {
      await next()
      return
    }

    const key = c.req.header("cf-connecting-ip") ?? "unknown"
    const { success } = await limiter.limit({ key })
    if (!success) {
      return errorResponse(
        c,
        429,
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        "Too many requests"
      )
    }

    await next()
  }
}

/**
 * フィードバック投稿向けのユーザー単位レートリミッター。
 * requireAuth の後に登録し、認証済み user.id をキーとして 60 秒間に 5 投稿まで許可する。
 * ローカルテスト等で binding が未注入の場合はレート制限をスキップする。
 */
export function createFeedbackSubmitLimiter(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const limiter = c.env?.FEEDBACK_SUBMIT_RATE_LIMITER
    if (!limiter) {
      await next()
      return
    }

    const { success } = await limiter.limit({ key: c.get("auth").user.id })
    if (!success) {
      return errorResponse(
        c,
        429,
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        "Too many requests"
      )
    }

    await next()
  }
}
