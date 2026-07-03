import * as Sentry from "@sentry/cloudflare";
import type { Hono } from "hono";
import { createApp, type AppEnv } from "./composition";
import { parseEnv, type Env } from "./infrastructure";

// isolate 起動後、最初のリクエストで一度だけアプリを構築する。
// Workers の isolate はリクエスト間で再利用されるため、モジュールスコープの
// let にキャッシュして毎リクエストの再構築を避ける。
let app: Hono<AppEnv> | undefined;

const handler = {
  fetch(req, rawEnv, ctx) {
    app ??= createApp(parseEnv(rawEnv as Record<string, unknown>));
    return app.fetch(req, rawEnv, ctx);
  },
} satisfies ExportedHandler<Env>;

export default Sentry.withSentry<Env>(
  (rawEnv) => {
    const env = rawEnv;
    // SENTRY_DSN が未設定の場合は undefined を返し、Sentry を無効のままにする
    // （ローカル開発などで本番 Sentry にノイズを送らないため）。
    if (!env.SENTRY_DSN) {
      return undefined;
    }
    return {
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
    };
  },
  handler,
);
