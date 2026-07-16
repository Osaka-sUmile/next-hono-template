import * as Sentry from "@sentry/cloudflare";
import { createApp } from "./composition";
import { parseEnv, type WorkerBindings } from "./infrastructure";

// rawEnv は Cloudflare Workers から渡される未検証の生 binding。
// 検証は parseEnv で行い、検証済みの Env はアプリ構築にのみ渡す。
//
// アプリはリクエスト単位で構築する。Neon serverless driver は WebSocket 接続を張るが、
// Workers は「あるリクエストで生成した I/O オブジェクトを別リクエストで使うこと」を
// 禁止するため、Prisma/Neon クライアントを isolate にキャッシュして使い回すと
// 2 回目以降の DB アクセスでハングする。接続リークを避けるためレスポンス後に
// prisma.$disconnect() を waitUntil で実行する。
const handler = {
  async fetch(req, rawEnv, ctx) {
    const { app, prisma } = await createApp(parseEnv(rawEnv));
    try {
      return await app.fetch(req, rawEnv, ctx);
    } finally {
      ctx.waitUntil(prisma.$disconnect());
    }
  },
} satisfies ExportedHandler<WorkerBindings>;

export default Sentry.withSentry<WorkerBindings>(
  (rawEnv) => {
    // ここでの rawEnv は未検証の生 binding のため、値は string | undefined として扱う。
    const sentryDsn = rawEnv.SENTRY_DSN;
    const sentryEnvironment = rawEnv.SENTRY_ENVIRONMENT;
    const nodeEnv = rawEnv.NODE_ENV;
    // SENTRY_DSN が未設定の場合は undefined を返し、Sentry を無効のままにする
    // （ローカル開発などで本番 Sentry にノイズを送らないため）。
    if (typeof sentryDsn !== "string" || !sentryDsn) {
      return undefined;
    }
    // preview / production はどちらも NODE_ENV=production のため、環境の識別には
    // SENTRY_ENVIRONMENT (wrangler.jsonc の env ごとの vars) を優先する。
    const environment =
      typeof sentryEnvironment === "string" && sentryEnvironment
        ? sentryEnvironment
        : typeof nodeEnv === "string"
          ? nodeEnv
          : undefined;
    return {
      dsn: sentryDsn,
      environment,
    };
  },
  handler,
);
