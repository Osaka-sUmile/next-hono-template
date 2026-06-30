import "dotenv/config";
import { createApp } from "./composition";
import { env, logger, initSentry } from "./infrastructure";
import { setupSwagger } from "./infrastructure";

// エラー監視はアプリ生成より前にできるだけ早く初期化する。
initSentry();

const bootstrap = async () => {
  const app = createApp();

  await setupSwagger(app);

  await new Promise<void>((resolve, reject) => {
    const server = app.listen(env.PORT, () => {
      logger.info({ port: env.PORT }, "API Server listening on port");
      resolve();
    });
    server.once("error", reject);
  });
};

bootstrap().catch((error) => {
  logger.error({ error }, "Error starting server");
  process.exit(1);
});

