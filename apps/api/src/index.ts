import "dotenv/config";
import { createApp } from "./composition";
import { env, logger } from "./infrastructure";
import { setupSwagger } from "./infrastructure";

const bootstrap = async () => {
  const app = createApp();

  await setupSwagger(app);

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "API Server listening on port");
  });
};

bootstrap().catch((error) => {
  logger.error({ error }, "Error starting server");
  process.exit(1);
});

