import type { Context } from "hono";
import { InvalidJsonBodyError } from "../errors";

/**
 * リクエストボディを JSON として読み取る Presentation 層のヘルパ。
 *
 * `c.req.json()` は不正・破損した JSON では `SyntaxError` を投げるが、body が既に
 * 消費済みの場合などは `TypeError` も投げうる。ここでは **JSON パース失敗
 * (`SyntaxError`) のみ** を `InvalidJsonBodyError` に変換し、onError で 400
 * VALIDATION_ERROR に写像させる。それ以外（`TypeError` 等の内部不具合）はそのまま
 * 再 throw し、500 INTERNAL_ERROR + Sentry の経路に委ねる。
 */
export async function readJsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new InvalidJsonBodyError(error);
    }
    throw error;
  }
}
