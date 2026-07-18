import { createTestPrismaClient } from "./db";

/**
 * 結合テスト開始前に DB の疎通を確認する。
 * docker の Postgres/wsproxy 起動直後は接続が確立しないことがあるため、
 * SELECT 1 が通るまでリトライしてから全テストを開始する。
 */
export default async function setup(): Promise<void> {
  const prisma = createTestPrismaClient();
  let lastError: unknown;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      await prisma.$disconnect();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  await prisma.$disconnect().catch(() => {});
  throw new Error(
    "結合テスト用の DB に接続できませんでした。docker compose (db / neon-wsproxy) の起動と " +
      "マイグレーション適用を確認してください。",
    { cause: lastError },
  );
}
