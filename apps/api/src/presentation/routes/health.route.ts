import { createRoute, z } from "@hono/zod-openapi"

export const healthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: ["System"],
  summary: "Checking API health",
  description: "Returns a simple message to verify that the API is running",
  responses: {
    200: {
      description: "API is healthy",
      content: {
        "application/json": {
          schema: z.object({ status: z.string().openapi({ example: "ok" }) }),
        },
      },
    },
  },
})
