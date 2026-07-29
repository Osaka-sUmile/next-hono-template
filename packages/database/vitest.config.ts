import { configDefaults, defineConfig } from "vitest/config"

// packages/database は「実 DB への結合テスト」が標準（詳細は CLAUDE.md / README の層別テスト戦略）。
// テストは docker の Postgres + wsproxy に対して実行するため、
//   1. docker compose up -d db neon-wsproxy
//   2. packages/database/.env に TEST_DATABASE_URL を設定（.env.example を参照）
//   3. pnpm --filter @workspace/database db:test:migrate:deploy
// を前提とする。turbo test（= pnpm test）には載せず、test:integration で明示的に実行する。
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // このパッケージのテストは全て実 DB 前提のため、*.integration.test.ts に限定する。
    // (将来 mapper 等の DB なし単体テストを置く場合も、この DB ハーネスには巻き込まない)
    include: ["src/**/*.integration.test.ts"],
    exclude: [...configDefaults.exclude, "dist/**"],
    // 実 DB を共有するため、truncate の競合を避けてファイル単位で直列実行する。
    fileParallelism: false,
    // DB 起動待ち・接続確立のため、単体テストより長めのタイムアウトを許容する。
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // DB の疎通確認（起動待ちリトライ）を全テスト前に一度だけ実行する。
    globalSetup: ["./src/test-utils/global-setup.ts"],
  },
})
