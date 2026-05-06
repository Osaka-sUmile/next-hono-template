import path from "path";
import type { Express } from "express";
import swaggerUi from "swagger-ui-express";
import SwaggerParser from "@apidevtools/swagger-parser";
import { env } from "./env";

/**
 * OpenAPI YAML はビルド成果物 (`dist/`) に含まれないため、
 * 配布形態に応じて OPENAPI_PATH で上書き可能にしている。
 * 未指定時は `apps/api/docs/openapi.yaml` を解決する。
 */
export async function setupSwagger(app: Express): Promise<void> {
  const apiSpecPath =
    env.OPENAPI_PATH ?? path.join(__dirname, "../../docs/openapi.yaml");
  const openapiSpecification = await SwaggerParser.dereference(apiSpecPath);

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiSpecification));
}
