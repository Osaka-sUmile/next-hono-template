import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";

export type CreatePrismaClientOptions = {
  /** query ログを有効にするか（開発環境向け）。 */
  queryLogging?: boolean;
  /**
   * ローカル開発用の wsproxy 経由接続を有効にするか。
   * true の場合、Neon serverless driver の WebSocket 接続先を
   * docker の wsproxy (localhost:5433) に向け、ローカル Postgres へ接続する。
   */
  localProxy?: boolean;
};

/**
 * Prisma Clientを都度生成するファクトリ。
 * 手動DIで利用し、テスト時の差し替えを容易にする。
 * Cloudflare Workers ランタイムで動作させるため、Neon serverless driver を利用する。
 */
export function createPrismaClient(
  connectionString: string,
  options: CreatePrismaClientOptions = {},
): PrismaClient {
  if (options.localProxy) {
    // ローカル開発では docker の wsproxy (localhost:5433) 経由でローカル Postgres に接続する。
    // 本番の Neon エンドポイントは TLS 終端の WebSocket を提供するが、
    // wsproxy はそれを再現するローカル代替のため、TLS/パイプライン系の最適化を無効化する。
    neonConfig.wsProxy = (host) => `${host}:5433/v1`;
    neonConfig.useSecureWebSocket = false;
    neonConfig.pipelineTLS = false;
    neonConfig.pipelineConnect = false;
  }

  const adapter = new PrismaNeon({ connectionString });

  return new PrismaClient({
    adapter,
    log: options.queryLogging ? ["query", "error", "warn"] : ["error"],
  });
}