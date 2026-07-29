import { createRoute, z } from "@hono/zod-openapi"
import { errorResponses } from "../openapi"
import { UserSchema } from "./user.route"

const USER_LIST_DEFAULT_LIMIT = 20
const USER_LIST_MAX_LIMIT = 100

export const AdminSummarySchema = z
  .object({
    userCount: z.number().int().nonnegative(),
    adminCount: z.number().int().nonnegative(),
    surveyCount: z.number().int().nonnegative(),
    activeSurveyCount: z.number().int().nonnegative(),
    submissionCount: z.number().int().nonnegative(),
    submissionCountLast7Days: z.number().int().nonnegative(),
  })
  .openapi("AdminSummary")

export const getAdminSummaryRoute = createRoute({
  method: "get",
  path: "/admin/summary",
  tags: ["Admin"],
  summary: "Get admin dashboard summary",
  description:
    "Returns user, survey, and submission KPIs. Requires an authenticated session whose role is admin.",
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: "Admin dashboard KPI summary",
      content: { "application/json": { schema: AdminSummarySchema } },
    },
    ...errorResponses({
      401: "Unauthorized (missing or invalid session)",
      403: "Forbidden (authenticated but not an admin)",
      500: "Internal Server Error",
    }),
  },
})

export const ListUsersQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(USER_LIST_MAX_LIMIT)
    .default(USER_LIST_DEFAULT_LIMIT)
    .openapi({
      param: { name: "limit", in: "query" },
      description: `Page size (1-${USER_LIST_MAX_LIMIT})`,
    }),
  // z.coerce.number() が null を 0 に変換して生成物を nullable にするため、
  // feedback.route.ts と同じく non-nullable integer の param.schema を明示する。
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .default(0)
    .openapi({
      param: {
        name: "offset",
        in: "query",
        schema: { type: "integer", minimum: 0, default: 0 },
      },
      description: "Number of users to skip",
    }),
  search: z
    .string()
    .trim()
    .max(100)
    .optional()
    .openapi({
      param: { name: "search", in: "query" },
      description:
        "Case-insensitive match against email, name, or display name",
    }),
  role: z
    .enum(["user", "admin"])
    .optional()
    .openapi({
      param: { name: "role", in: "query" },
      description: "Restrict results to one user role",
    }),
})

export const UserListSchema = z
  .object({
    items: z.array(UserSchema),
    total: z
      .number()
      .int()
      .openapi({ description: "Total users matching the filters" }),
    limit: z.number().int(),
    offset: z.number().int(),
  })
  .openapi("UserList")

export const listUsersRoute = createRoute({
  method: "get",
  path: "/admin/users",
  tags: ["Admin"],
  summary: "Search users (admin only)",
  description:
    "Search and page through users. Requires an authenticated session whose role is admin.",
  security: [{ cookieAuth: [] }],
  request: { query: ListUsersQuerySchema },
  responses: {
    200: {
      description: "A page of users",
      content: { "application/json": { schema: UserListSchema } },
    },
    ...errorResponses({
      400: "Invalid paging or filter parameters (VALIDATION_ERROR)",
      401: "Unauthorized (missing or invalid session)",
      403: "Forbidden (authenticated but not an admin)",
      500: "Internal Server Error",
    }),
  },
})
