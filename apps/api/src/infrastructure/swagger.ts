import type { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import type { AppEnv } from "../presentation/app-env";

/**
 * OpenAPI route definitions from presentation/routes are registered by OpenAPIHono and
 * emitted at runtime. The served URLs stay stable for existing API documentation links.
 */
export function setupSwagger(app: OpenAPIHono<AppEnv>): void {
  app.openAPIRegistry.registerComponent("securitySchemes", "cookieAuth", {
    type: "apiKey",
    in: "cookie",
    name: "better-auth.session_token",
  });
  app.doc("/api-docs/openapi.json", {
    openapi: "3.0.3",
    info: { title: "API", description: "Backend API specification", version: "1.0.0" },
    servers: [{ url: "/", description: "Same origin as this document" }],
  });
  app.get("/api-docs", swaggerUI({ url: "/api-docs/openapi.json" }));
}
