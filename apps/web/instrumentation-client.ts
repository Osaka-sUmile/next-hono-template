import * as Sentry from "@sentry/nextjs";
import { resolveTracesSampleRate } from "@/lib/sentry-traces-sample-rate";

// クライアント側の Sentry 初期化。
// NEXT_PUBLIC_SENTRY_DSN が未設定なら dsn が undefined となり、エラー監視は無効。
// environment は NEXT_PUBLIC_SENTRY_ENVIRONMENT を優先する。preview / production は
// どちらも NODE_ENV=production でビルドされるため、環境の識別はこの変数で行う
// (CI がデプロイ先環境名をビルド時に注入する。未設定時は NODE_ENV にフォールバック)。
// `||` で空文字も NODE_ENV へフォールバックさせる (API 側の実装と挙動を揃える)。
// tracesSampleRate は環境ごとに変える（既定値は lib/sentry-traces-sample-rate.ts）。
// これを設定して初めてページ遷移やブラウザ側の計測がトランザクションとして送られる。
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  tracesSampleRate: resolveTracesSampleRate(
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  ),
});

// App Router のクライアントサイドナビゲーションを計測する。
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
