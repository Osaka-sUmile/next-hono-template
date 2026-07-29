import { createRoute, z } from "@hono/zod-openapi"
import { errorResponses } from "../openapi"
import { UserSchema } from "./user.route"

export const listUsersRoute = createRoute({
  method: "get",
  path: "/admin/users",
  tags: ["Admin"],
  summary: "List all users (admin only)",
  description:
    "Retrieve all users. Requires an authenticated session whose role is admin.",
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: "A list of users",
      content: { "application/json": { schema: z.array(UserSchema) } },
    },
    ...errorResponses({
      401: "Unauthorized (missing or invalid session)",
      403: "Forbidden (authenticated but not an admin)",
      500: "Internal Server Error",
    }),
  },
})
