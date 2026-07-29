import type { Context } from "hono"
import type { ErrorCode, ErrorResponseBody } from "../errors"

/**
 * errorResponse が返しうる HTTP ステータス。ErrorCodes 各コードが ErrorSchema に
 * 対応づけられているステータス（400/401/403/404/429/500）の集合で、いずれも
 * Hono の ContentfulStatusCode の部分集合。hono の非公開サブパス
 * (`hono/utils/http-status`) への deep import を避けるため、ここで自己完結させる。
 */
type ErrorStatusCode = 400 | 401 | 403 | 404 | 429 | 500

/**
 * エラーレスポンスを `{ error, code }` の形で組み立てて返す Presentation 層のヘルパ。
 *
 * OpenAPI ErrorSchema（required: error, code）と一致する body 形状を1箇所に固定し、
 * 各コントローラ・ミドルウェアが `c.json({ error, code }, status)` を手組みして
 * キー名・形をドリフトさせるのを防ぐ。JSON パースとは無関係で、あくまで
 * 「エラーをレスポンスとして返す」出力側の配管である。
 *
 * status を型引数で受けるのは、OpenAPI ルートハンドラ（RouteHandler）の戻り値が
 * 宣言済みステータスごとの TypedResponse を要求するためである。引数型を
 * ErrorStatusCode のユニオンのままにすると戻り値のステータスも union に広がり、
 * 「404 を返すハンドラ」に代入できなくなる。
 */
export function errorResponse<TStatus extends ErrorStatusCode>(
  c: Context,
  status: TStatus,
  code: ErrorCode,
  message: string
) {
  const body: ErrorResponseBody = { error: message, code }
  return c.json(body, status)
}
