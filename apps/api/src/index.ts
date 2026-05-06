import "dotenv/config";
import { createApp } from "./composition";
import { env } from "./infrastructure";
import { setupSwagger } from "./infrastructure";

const bootstrap = async () => {
  const app = createApp();

  await setupSwagger(app);

  app.listen(env.PORT, () => {
    console.log(`API Server listening on port ${env.PORT}`);
  });
};

bootstrap().catch((error) => {
  console.error("Error starting server", error);
  process.exit(1);
});

