import type { RouteHandler } from "@hono/zod-openapi";
import type { AppEnv } from "../app-env";
import type { healthRoute } from "../routes";

export class HealthController {
  check: RouteHandler<typeof healthRoute, AppEnv> = (c) => {
    c.header("Cache-Control", "public, max-age=300");
    return c.json({ status: "ok" }, 200);
  };
}
