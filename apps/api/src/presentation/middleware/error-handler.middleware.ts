import type { ErrorHandler } from "hono";
import * as Sentry from "@sentry/node";
import { env, logger } from "../../infrastructure";
import { ErrorCodes } from "../error-codes";

/**
 * 未処理エラーを捕捉するグローバルエラーハンドラーを生成する（Hono の app.onError に登録する）。
 * すべてのエラーを 500 で INTERNAL_ERROR として返す。
 * 本番環境では詳細メッセージを隠蔽し、開発環境では err.message を返す。
 */
export function createErrorHandler(): ErrorHandler {
  return (err, c) => {
    // Sentry へ送信（DSN 未設定なら init されていないため no-op）。
    Sentry.captureException(err);
    logger.error({ err }, "[errorHandler] Unhandled error");
    return c.json(
      {
        error: env.NODE_ENV === "production" ? "Internal Server Error" : err.message,
        code: ErrorCodes.INTERNAL_ERROR,
      },
      500,
    );
  };
}
