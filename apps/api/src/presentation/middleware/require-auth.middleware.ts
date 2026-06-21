import { Request, Response, NextFunction, type RequestHandler } from "express";
import { fromNodeHeaders } from "@workspace/auth/server";
import type { AuthInstance } from "@workspace/auth/server";
import { logger } from "../../infrastructure";
import { ErrorCodes } from "../error-codes";

export type AuthSession = NonNullable<Awaited<ReturnType<AuthInstance["api"]["getSession"]>>>;

export type AuthenticatedRequest = Request & {
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

// requireAuth が先行して auth を設定していることを前提とする。
// 型アサーションをここに集約することで、ルート登録側でのキャストを不要にする。
export function withAuth(
  handler: (req: AuthenticatedRequest, res: Response) => Promise<void> | void,
): RequestHandler {
  return (req, res, next) => {
    const result = handler(req as AuthenticatedRequest, res);
    if (result instanceof Promise) {
      result.catch(next);
    }
  };
}

export function createRequireAuth(auth: AuthInstance) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session) {
        return res.status(401).json({ error: "Unauthorized", code: ErrorCodes.SESSION_INVALID });
      }
      (req as AuthenticatedRequest).auth = session;
      next();
    } catch (err) {
      if (isBetterAuthAPIError(err) && err.statusCode === 401) {
        const isExpired = err.body?.code === "SESSION_EXPIRED";
        return res.status(401).json({
          error: isExpired ? "Session expired" : "Unauthorized",
          code: isExpired ? ErrorCodes.SESSION_EXPIRED : ErrorCodes.SESSION_INVALID,
        });
      }
      logger.error({ err }, "[requireAuth] getSession failed");
      return res.status(500).json({ error: "Internal Server Error", code: ErrorCodes.SESSION_FETCH_FAILED });
    }
  };
}
