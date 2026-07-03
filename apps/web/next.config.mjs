import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui"],
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // 注意: このヘッダーは Next.js サーバー (Worker) を経由するレスポンスにのみ適用される。
  // Cloudflare Workers Assets が直接配信する /_next/static/* 等の静的アセットには
  // 効かないため、public/_headers で別途 Cache-Control を補っている。
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

// 最小構成: ソースマップの自動アップロードは無効（org/project/authToken 不要）。
export default withSentryConfig(nextConfig, {
  silent: true,
  sourcemaps: { disable: true },
});

// `next dev` 実行時のみ Cloudflare bindings (wrangler.jsonc の vars/services 等) を
// プロキシしてローカル開発から参照できるようにする。
//
// 本来は `next build` 時に no-op となる想定だが、Next.js 16 の Turbopack ビルドでは
// 静的生成ワーカープロセスにも AsyncLocalStorage が存在するため、パッケージ内部の
// 判定 (shouldContextInitializationRun) だけでは dev/build を区別できず、
// ビルド中に miniflare (workerd) が起動して SQLite ロック等で異常終了する事象を確認した。
// そのため NODE_ENV === "development" (= `next dev` 実行時のみ) の明示ガードを設ける。
if (process.env.NODE_ENV === "development") {
  const { initOpenNextCloudflareForDev } = await import("@opennextjs/cloudflare");
  await initOpenNextCloudflareForDev();
}
