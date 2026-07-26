import * as Sentry from "@sentry/cloudflare";
import { createApp } from "./composition";
import { parseEnv, resolveSentryOptions, type WorkerBindings } from "./infrastructure";

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

// オプションの組み立ては infrastructure/sentry-options.ts に集約している。
// withSentry のコールバックは parseEnv を通す前の生 binding を受け取るため、
// 値の解釈（DSN の有無・環境名・サンプリング率）はそちらでテスト可能な形にしてある。
export default Sentry.withSentry<WorkerBindings>(resolveSentryOptions, handler);
