import "dotenv/config";
import type { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "../client";

/**
 * 結合テスト用の PrismaClient を生成する。
 * ローカル docker の wsproxy (localhost:5433) 経由で実 Postgres に接続する。
 * これは apps/api のローカル開発 (createPrismaClient(..., { localProxy: true })) と同一経路で、
 * 本番の Neon serverless driver と同じコードパスを実 DB に対して検証できる。
 */
export function createTestPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL が未設定です。DB 結合テストには docker の Postgres/wsproxy と " +
        "packages/database/.env が必要です (README の Testing セクション参照)。",
    );
  }
  return createPrismaClient(url, { localProxy: true });
}

/**
 * public スキーマの全テーブルを truncate し、テスト間の独立性を担保する。
 * 実行順に依存しないよう、各テストの前 (beforeEach) に呼ぶこと。
 * _prisma_migrations はマイグレーション状態を保持するため対象外にする。
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  // pg_tables.tablename は Postgres の `name` 型で Neon アダプタが変換できないため text にキャストする。
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename::text AS tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
