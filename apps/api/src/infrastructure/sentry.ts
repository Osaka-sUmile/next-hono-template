import * as Sentry from "@sentry/node";
import { env } from "./env";
import { logger } from "./logger";

/**
 * Sentry を初期化する。
 * SENTRY_DSN が未設定の場合は初期化せず、エラー監視を無効のままにする
 * （ローカル開発などで本番 Sentry にノイズを送らないため）。
 * アプリ起動時にできるだけ早く一度だけ呼び出すこと。
 */
export function initSentry(): void {
  if (!env.SENTRY_DSN) {
    logger.info("[sentry] SENTRY_DSN is not set; error monitoring is disabled");
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
  });
  logger.info("[sentry] error monitoring is enabled");
}
