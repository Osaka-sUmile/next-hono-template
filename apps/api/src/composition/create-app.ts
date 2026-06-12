import express from "express";
import cors from "cors";
import { createAuth, toNodeHandler } from "@workspace/auth/server";
import { createPrismaClient, UserQueryService } from "@workspace/database";
import { GetCurrentUserUseCase } from "../application";
import { HealthController, UserController, createRequireAuth, withAuth } from "../presentation";
import { env, logger } from "../infrastructure";

type RouterDeps = {
  requireAuth: ReturnType<typeof createRequireAuth>;
  healthController: HealthController;
  userController: UserController;
};

function buildV1Router(deps: RouterDeps): express.Router {
  const router = express.Router();
  router.get("/health", deps.healthController.check);
  router.get("/me", deps.requireAuth, withAuth(deps.userController.getUserMe));
  return router;
}

export function createApp(): express.Express {
  const prisma = createPrismaClient(env.DATABASE_URL, env.NODE_ENV === "development");
  const auth = createAuth({
    prisma,
    secret: env.AUTH_SECRET,
    baseURL: env.API_BASE_URL,
    resendApiKey: env.RESEND_API_KEY,
    resendFromEmail: env.RESEND_FROM_EMAIL,
    google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
    apple: { clientId: env.APPLE_CLIENT_ID, clientSecret: env.APPLE_CLIENT_SECRET },
  });

  const app = express();

  // cors はすべてのルートに適用するため先行させる
  app.use(cors({ origin: env.WEB_BASE_URL, credentials: true }));
  // toNodeHandler はボディストリームを直接読むため express.json() より前に配置する
  app.use("/api/auth", toNodeHandler(auth));
  app.use(express.json());

  const requireAuth = createRequireAuth(auth);
  const userQueryService = new UserQueryService(prisma);
  const getCurrentUserUseCase = new GetCurrentUserUseCase(userQueryService);

  app.use(
    "/api/v1",
    buildV1Router({
      requireAuth,
      healthController: new HealthController(),
      userController: new UserController(getCurrentUserUseCase),
    }),
  );

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    logger.error({ err }, "[createApp] Unhandled error");
    res.status(500).json({
      error: env.NODE_ENV === "production" ? "Internal Server Error" : message,
      code: "INTERNAL_ERROR",
    });
  });

  return app;
}
