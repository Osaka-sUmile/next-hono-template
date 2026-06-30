import "dotenv/config";
import { serve } from "@hono/node-server";
import { createApp } from "./composition";
import { env, logger, initSentry } from "./infrastructure";
import { setupSwagger } from "./infrastructure";

// エラー監視はアプリ生成より前にできるだけ早く初期化する。
initSentry();

const bootstrap = async () => {
  const app = createApp();

  await setupSwagger(app);

  serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    logger.info({ port: info.port }, "API Server listening on port");
  });
};

bootstrap().catch((error) => {
  logger.error({ error }, "Error starting server");
  process.exit(1);
});
