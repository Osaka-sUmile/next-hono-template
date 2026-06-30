import * as Sentry from "@sentry/nextjs";

// クライアント側の Sentry 初期化。
// NEXT_PUBLIC_SENTRY_DSN が未設定なら dsn が undefined となり、エラー監視は無効。
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

// App Router のクライアントサイドナビゲーションを計測する。
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
