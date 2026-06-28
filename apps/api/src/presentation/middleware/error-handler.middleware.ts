import type { ErrorRequestHandler } from "express";
import { env, logger } from "../../infrastructure";
import { ErrorCodes } from "../error-codes";

/**
 * 未処理エラーを捕捉するグローバルエラーハンドラーを生成する。
 * すべてのエラーを 500 で INTERNAL_ERROR として返す。
 * 本番環境では詳細メッセージを隠蔽し、開発環境では err.message を返す。
 */
export function createErrorHandler(): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    logger.error({ err }, "[errorHandler] Unhandled error");
    res.status(500).json({
      error: env.NODE_ENV === "production" ? "Internal Server Error" : message,
      code: ErrorCodes.INTERNAL_ERROR,
    });
  };
}
