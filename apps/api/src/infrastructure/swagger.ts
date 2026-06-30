import path from "path";
import type { Env, Hono } from "hono";
import { swaggerUI } from "@hono/swagger-ui";
import SwaggerParser from "@apidevtools/swagger-parser";
import { env } from "./env";

/**
 * OpenAPI YAML はビルド成果物 (`dist/`) に含まれないため、
 * 配布形態に応じて OPENAPI_PATH で上書き可能にしている。
 * 未指定時は `apps/api/docs/openapi.yaml` を解決する。
 *
 * dereference 済みの spec を JSON として配信し、Swagger UI からそれを参照させる。
 */
export async function setupSwagger<E extends Env>(app: Hono<E>): Promise<void> {
  const apiSpecPath =
    env.OPENAPI_PATH ?? path.join(__dirname, "../../docs/openapi.yaml");
  const openapiSpecification = await SwaggerParser.dereference(apiSpecPath);

  app.get("/api-docs/openapi.json", (c) => c.json(openapiSpecification));
  app.get("/api-docs", swaggerUI({ url: "/api-docs/openapi.json" }));
}
