import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { createAuth } from "@workspace/auth/server";
import type { AuthInstance } from "@workspace/auth/server";
import { createPrismaClient, UserQueryService } from "@workspace/database";
import { GetCurrentUserUseCase } from "../application";
import {
  HealthController,
  UserController,
  createAuthLimiter,
  createErrorHandler,
  createRequireAuth,
  type AuthVariables,
} from "../presentation";
import { setupSwagger, type Env } from "../infrastructure";

export type AppEnv = { Variables: AuthVariables };

export type AppDeps = {
  env: Env;
  auth: AuthInstance;
  healthController: HealthController;
  userController: UserController;
};

/**
 * 依存を受け取り Hono アプリを組み立てる。
 * 実依存の構築は createApp() が担い、テストではモック依存を渡して app.request() で検証する。
 */
export function buildApp(deps: AppDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // 未処理エラーは onError で一元的に捕捉する（Sentry 送信・ログもここで実施）。
  app.onError(createErrorHandler(deps.env.NODE_ENV));

  app.use(secureHeaders());
  // cors はすべてのルートに適用するため先行させる
  app.use(cors({ origin: deps.env.WEB_BASE_URL, credentials: true }));

  // better-auth ハンドラ。レート制限を先行適用し、Web 標準の Request をそのまま渡す。
  app.use("/api/auth/*", createAuthLimiter());
  app.on(["GET", "POST"], "/api/auth/*", (c) => deps.auth.handler(c.req.raw));

  const requireAuth = createRequireAuth(deps.auth);

  const v1 = new Hono<AppEnv>();
  // v1 配下のデフォルトキャッシュ方針。個別ハンドラが上書き可能なよう next() より前に設定する。
  v1.use(async (c, next) => {
    c.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
    await next();
  });
  v1.get("/health", deps.healthController.check);
  v1.get("/me", requireAuth, deps.userController.getUserMe);

  app.route("/api/v1", v1);

  setupSwagger(app);

  return app;
}

export function createApp(env: Env): Hono<AppEnv> {
  const prisma = createPrismaClient(env.DATABASE_URL, {
    queryLogging: env.NODE_ENV === "development",
    localProxy: env.NODE_ENV === "development",
  });
  const auth = createAuth({
    prisma,
    secret: env.AUTH_SECRET,
    baseURL: env.API_BASE_URL,
    trustedOrigins: [env.WEB_BASE_URL],
    resendApiKey: env.RESEND_API_KEY,
    resendFromEmail: env.RESEND_FROM_EMAIL,
    google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
    apple: { clientId: env.APPLE_CLIENT_ID, clientSecret: env.APPLE_CLIENT_SECRET },
  });

  const userQueryService = new UserQueryService(prisma);
  const getCurrentUserUseCase = new GetCurrentUserUseCase(userQueryService);

  return buildApp({
    env,
    auth,
    healthController: new HealthController(),
    userController: new UserController(getCurrentUserUseCase),
  });
}
