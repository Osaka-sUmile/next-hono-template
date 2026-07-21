import type { MiddlewareHandler } from "hono";
import type { AuthVariables } from "./require-auth.middleware";
import { ErrorCodes } from "../errors";
import { errorResponse } from "../http";

/**
 * admin ロールを要求するミドルウェア。
 *
 * requireAuth の後段に合成する前提で、`c.get("auth")` のセッションから role を検証する。
 * role は better-auth の additionalFields (input:false) でクライアントからは書き換え不可のため、
 * セッションの値を信頼でき、認可のために DB を引き直す必要はない。
 *
 * requireAuth が先に実行されていれば auth は必ず存在するが、ミドルウェアの合成順序ミスに
 * 備えて防御的に扱い、admin でなければ 403 を返す。
 */
export const requireAdmin: MiddlewareHandler<{ Variables: AuthVariables }> = async (c, next) => {
  const role = c.get("auth")?.user?.role;
  if (role !== "admin") {
    return errorResponse(c, 403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  await next();
};
