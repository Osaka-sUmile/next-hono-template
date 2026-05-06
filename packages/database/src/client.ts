import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

/**
 * Prisma Clientを都度生成するファクトリ。
 * 手動DIで利用し、テスト時の差し替えを容易にする。
 */
export function createPrismaClient(
  connectionString: string,
  enableQueryLogging = false,
): PrismaClient {
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: enableQueryLogging ? ["query", "error", "warn"] : ["error"],
  });
}