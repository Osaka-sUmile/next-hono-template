import type { ErrorHandler } from "hono";
import * as Sentry from "@sentry/cloudflare";
import { ZodError } from "zod";
import { logger } from "../../infrastructure";
import type { Env } from "../../infrastructure";
import { ErrorCodes, InvalidJsonBodyError } from "../errors";
import { errorResponse } from "../http";

/**
 * ZodError の issues を「path: message」形式の簡潔な要約文字列へ整形する。
 * 検証エラーは利用者の入力起因で機微情報ではないため、環境に依らずクライアントへ返す。
 */
function formatZodError(err: ZodError): string {
  return err.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

/**
 * 未処理エラーを捕捉するグローバルエラーハンドラーを生成する（Hono の app.onError に登録する）。
 *
 * - リクエスト検証エラー（Zod スキーマ不一致 = ZodError / 不正 JSON ボディ =
 *   InvalidJsonBodyError）は利用者の入力起因の想定内エラーとして 400 VALIDATION_ERROR で返す。
 *   リトライ不能な入力不備を内部障害として扱わないよう Sentry には送信しない。
 * - それ以外の予期しない例外は従来どおり 500 INTERNAL_ERROR として Sentry へ送信する
 *   （アプリケーション内部で発生する SyntaxError もここに含まれる）。
 *   本番環境では詳細メッセージを隠蔽し、開発環境では err.message を返す。
 */
export function createErrorHandler(nodeEnv: Env["NODE_ENV"]): ErrorHandler {
  return (err, c) => {
    // リクエストボディのスキーマ検証失敗（Presentation 境界の Zod .parse()）。
    if (err instanceof ZodError) {
      logger.info({ err }, "[errorHandler] Request validation failed");
      return errorResponse(c, 400, ErrorCodes.VALIDATION_ERROR, formatZodError(err));
    }

    // 不正・破損した JSON ボディ（c.req.json() の失敗を専用エラーに変換したもの）。
    // 汎用の SyntaxError は拾わない（アプリ由来の SyntaxError を 400 と誤判定しないため）。
    if (err instanceof InvalidJsonBodyError) {
      logger.info({ err }, "[errorHandler] Malformed JSON request body");
      return errorResponse(c, 400, ErrorCodes.VALIDATION_ERROR, err.message);
    }

    // 予期しないエラー。Sentry へ送信（DSN 未設定なら withSentry が初期化しないため no-op）。
    Sentry.captureException(err);
    logger.error({ err }, "[errorHandler] Unhandled error");
    return errorResponse(
      c,
      500,
      ErrorCodes.INTERNAL_ERROR,
      nodeEnv === "production" ? "Internal Server Error" : err.message,
    );
  };
}
