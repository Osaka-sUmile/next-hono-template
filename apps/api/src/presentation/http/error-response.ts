import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ErrorCode, ErrorResponseBody } from "../errors";

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
  status: ContentfulStatusCode,
  code: ErrorCode,
  message: string,
) {
  const body: ErrorResponseBody = { error: message, code };
  return c.json(body, status);
}
