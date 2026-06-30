import type { Context } from "hono";

export class HealthController {
  check = (c: Context) => {
    c.header("Cache-Control", "public, max-age=300");
    return c.json({ status: "ok" });
  };
}
