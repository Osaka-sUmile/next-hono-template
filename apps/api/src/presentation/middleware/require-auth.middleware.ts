import type { MiddlewareHandler } from "hono";
import type { AuthInstance } from "@workspace/auth/server";
import { ErrorCodes } from "../error-codes";

export type AuthSession = NonNullable<Awaited<ReturnType<AuthInstance["api"]["getSession"]>>>;

/**
 * requireAuth が Context に設定する変数。
 * Hono アプリの `Variables` 型として合成し、`c.get("auth")` を型安全にする。
 */
export type AuthVariables = {
  auth: AuthSession;
};

type BetterAuthAPIError = {
  statusCode: number;
  body?: { code?: string };
};

// better-auth/better-call の APIError は const 宣言のため instanceof で型が絞り込めない。
// InternalAPIError extends Error かつ statusCode: number を持つ構造を直接検査する。
function isBetterAuthAPIError(err: unknown): err is BetterAuthAPIError {
  return (
    err instanceof Error &&
    "statusCode" in err &&
    typeof (err as { statusCode: unknown }).statusCode === "number"
  );
}

export function createRequireAuth(
  auth: AuthInstance,
): MiddlewareHandler<{ Variables: AuthVariables }> {
  return async (c, next) => {
    // try は getSession の呼び出しのみを囲む。await next() を含めると後続ハンドラの例外まで
    // ここで捕捉され、認証エラーとして誤分類される恐れがあるため、スコープを限定する。
    let session: AuthSession | null;
    try {
      // c.req.raw.headers は Web 標準の Headers なのでそのまま渡せる。
      session = await auth.api.getSession({ headers: c.req.raw.headers });
    } catch (err) {
      // 想定内: better-auth が 401 を返すケースはここでレスポンスを返す（Sentry 送信対象外）。
      if (isBetterAuthAPIError(err) && err.statusCode === 401) {
        const isExpired = err.body?.code === "SESSION_EXPIRED";
        return c.json(
          {
            error: isExpired ? "Session expired" : "Unauthorized",
            code: isExpired ? ErrorCodes.SESSION_EXPIRED : ErrorCodes.SESSION_INVALID,
          },
          401,
        );
      }
      // 想定外エラーは onError に委譲（ログ・Sentry 送信はそこで一元化）。
      throw err;
    }

    if (!session) {
      return c.json({ error: "Unauthorized", code: ErrorCodes.SESSION_INVALID }, 401);
    }
    c.set("auth", session);
    await next();
  };
}
