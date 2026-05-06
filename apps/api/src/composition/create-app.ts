import express from "express";
import { HealthController } from "../presentation";

export function createApp(): express.Express {
  const app = express();

  app.use(express.json());

  const apiRouter = express.Router();
  const healthController = new HealthController();

  apiRouter.get("/health", healthController.check);

  app.use("/api/v1", apiRouter);

  return app;
}