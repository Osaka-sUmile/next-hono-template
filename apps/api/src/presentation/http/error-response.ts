import type { Context } from "hono";
import type { ErrorCode, ErrorResponseBody } from "../errors";

/**
 * errorResponse が返しうる HTTP ステータス。ErrorCodes 各コードが Error.yaml で
 * 対応づけられているステータス（400/401/403/404/429/500）の集合で、いずれも
 * Hono の ContentfulStatusCode の部分集合。hono の非公開サブパス
 * (`hono/utils/http-status`) への deep import を避けるため、ここで自己完結させる。
 */
type ErrorStatusCode = 400 | 401 | 403 | 404 | 429 | 500;

/**
 * エラーレスポンスを `{ error, code }` の形で組み立てて返す Presentation 層のヘルパ。
 *
 * OpenAPI `Error.yaml`（required: error, code）と一致する body 形状を1箇所に固定し、
 * 各コントローラ・ミドルウェアが `c.json({ error, code }, status)` を手組みして
 * キー名・形をドリフトさせるのを防ぐ。JSON パースとは無関係で、あくまで
 * 「エラーをレスポンスとして返す」出力側の配管である。
 */
export function errorResponse(
  c: Context,
  status: ErrorStatusCode,
  code: ErrorCode,
  message: string,
) {
  const body: ErrorResponseBody = { error: message, code };
  return c.json(body, status);
}
