import * as Sentry from "@sentry/nextjs";

// クライアント側の Sentry 初期化。
// NEXT_PUBLIC_SENTRY_DSN が未設定なら dsn が undefined となり、エラー監視は無効。
// environment は NEXT_PUBLIC_SENTRY_ENVIRONMENT を優先する。preview / production は
// どちらも NODE_ENV=production でビルドされるため、環境の識別はこの変数で行う
// (CI がデプロイ先環境名をビルド時に注入する。未設定時は NODE_ENV にフォールバック)。
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
});

// App Router のクライアントサイドナビゲーションを計測する。
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
