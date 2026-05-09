import express, { type RequestHandler } from "express";
import cors from "cors";
import { createAuth, toNodeHandler } from "@workspace/auth/server";
import { createPrismaClient, UserQueryService } from "@workspace/database";
import { GetCurrentUserUseCase } from "../application";
import { HealthController, UserController, createRequireAuth } from "../presentation";
import { env } from "../infrastructure/env";

export function createApp(): express.Express {
  const prisma = createPrismaClient(env.DATABASE_URL, env.NODE_ENV === "development");
  const auth = createAuth({
    prisma,
    secret: env.AUTH_SECRET,
    baseURL: env.API_BASE_URL,
    resendApiKey: env.RESEND_API_KEY,
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
  const userController = new UserController(getCurrentUserUseCase);

  const apiRouter = express.Router();
  const healthController = new HealthController();

  apiRouter.get("/health", healthController.check);
  apiRouter.get("/me", requireAuth, userController.getUserMe as unknown as RequestHandler);

  app.use("/api/v1", apiRouter);

  return app;
}
