import { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "@workspace/auth/server";
import type { AuthInstance } from "@workspace/auth/server";

export type AuthenticatedRequest = Request & {
  auth: NonNullable<Awaited<ReturnType<AuthInstance["api"]["getSession"]>>>;
};

export function createRequireAuth(auth: AuthInstance) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      (req as AuthenticatedRequest).auth = session;
      next();
    } catch (err) {
      console.error("[requireAuth] getSession failed:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  };
}
