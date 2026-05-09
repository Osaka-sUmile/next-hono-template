import { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "@workspace/auth/server";
import type { AuthInstance } from "@workspace/auth/server";
import { logger } from "../../infrastructure";
import { ErrorCodes } from "../error-codes";

export type AuthSession = NonNullable<Awaited<ReturnType<AuthInstance["api"]["getSession"]>>>;

export type AuthenticatedRequest = Request & {
  auth: AuthSession;
};

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
      if (err instanceof Error && "status" in err && (err as { status: number }).status === 401) {
        return res.status(401).json({ error: "Session expired", code: ErrorCodes.SESSION_EXPIRED });
      }
      logger.error({ err }, "[requireAuth] getSession failed");
      return res.status(500).json({ error: "Internal Server Error", code: ErrorCodes.SESSION_FETCH_FAILED });
    }
  };
}
