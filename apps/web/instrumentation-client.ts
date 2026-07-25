import * as Sentry from "@sentry/nextjs";
import { resolveTracesSampleRate } from "@workspace/common";

// クライアント側の Sentry 初期化。
// NEXT_PUBLIC_SENTRY_DSN が未設定なら dsn が undefined となり、エラー監視は無効。
// environment は NEXT_PUBLIC_SENTRY_ENVIRONMENT を優先する。preview / production は
// どちらも NODE_ENV=production でビルドされるため、環境の識別はこの変数で行う
// (CI がデプロイ先環境名をビルド時に注入する。未設定時は NODE_ENV にフォールバック)。
// `||` で空文字も NODE_ENV へフォールバックさせる (API 側の実装と挙動を揃える)。
// tracesSampleRate は環境ごとに変える（既定値・解釈ロジックは @workspace/common に集約）。
// これを設定して初めてページ遷移やブラウザ側の計測がトランザクションとして送られる。
const environment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment,
  tracesSampleRate: resolveTracesSampleRate(
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
    environment,
  ),
});

// App Router のクライアントサイドナビゲーションを計測する。
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
