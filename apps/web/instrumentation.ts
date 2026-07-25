import * as Sentry from "@sentry/nextjs";
import { resolveTracesSampleRate } from "@/lib/sentry-traces-sample-rate";

// サーバー／エッジランタイムの Sentry 初期化。
// NEXT_PUBLIC_SENTRY_DSN が未設定なら dsn が undefined となり、エラー監視は無効。
// environment は NEXT_PUBLIC_SENTRY_ENVIRONMENT を優先する (instrumentation-client.ts と同じ理由)。
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    const environment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV;
    // tracesSampleRate は nodejs / edge の両ランタイムで同じ値を使う
    // （既定値は lib/sentry-traces-sample-rate.ts）。
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment,
      tracesSampleRate: resolveTracesSampleRate(
        process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
        environment,
      ),
    });
  }
}

// App Router のサーバー側で発生したエラーを Sentry に送信する。
export const onRequestError = Sentry.captureRequestError;
