import * as Sentry from "@sentry/cloudflare";
import type { Hono } from "hono";
import { createApp, type AppEnv } from "./composition";
import { parseEnv, type WorkerBindings } from "./infrastructure";

// isolate 起動後、最初のリクエストで一度だけアプリを構築する。
// Workers の isolate はリクエスト間で再利用されるため、モジュールスコープの
// let にキャッシュして毎リクエストの再構築を避ける。
let app: Hono<AppEnv> | undefined;

// rawEnv は Cloudflare Workers から渡される未検証の生 binding。
// 検証は parseEnv で行い、検証済みの Env はアプリ構築にのみ渡す。
const handler = {
  fetch(req, rawEnv, ctx) {
    app ??= createApp(parseEnv(rawEnv));
    return app.fetch(req, rawEnv, ctx);
  },
} satisfies ExportedHandler<WorkerBindings>;

export default Sentry.withSentry<WorkerBindings>(
  (rawEnv) => {
    // ここでの rawEnv は未検証の生 binding のため、値は string | undefined として扱う。
    const sentryDsn = rawEnv.SENTRY_DSN;
    const nodeEnv = rawEnv.NODE_ENV;
    // SENTRY_DSN が未設定の場合は undefined を返し、Sentry を無効のままにする
    // （ローカル開発などで本番 Sentry にノイズを送らないため）。
    if (typeof sentryDsn !== "string" || !sentryDsn) {
      return undefined;
    }
    return {
      dsn: sentryDsn,
      environment: typeof nodeEnv === "string" ? nodeEnv : undefined,
    };
  },
  handler,
);
