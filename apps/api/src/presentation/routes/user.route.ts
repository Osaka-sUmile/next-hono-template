import { createRoute, z } from "@hono/zod-openapi"
import { errorResponses } from "../openapi"

const DISPLAY_NAME_MAX_LENGTH = 100

export const UserSchema = z
  .object({
    id: z.string().openapi({ description: "The user ID" }),
    email: z.email().openapi({ description: "User email address" }),
    name: z.string().openapi({ description: "User full name" }),
    role: z.enum(["user", "admin"]).openapi({ description: "User role" }),
    displayName: z
      .string()
      .nullable()
      .openapi({ description: "User display name (user-settable)" }),
    image: z.string().nullable().openapi({ description: "User avatar URL" }),
    emailVerified: z
      .boolean()
      .openapi({ description: "Whether the email address has been verified" }),
    createdAt: z.string().datetime(),
  })
  .openapi("User")

const UpdateUserMeBodySchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(DISPLAY_NAME_MAX_LENGTH)
    .nullable()
    .transform((value) => (value === "" ? null : value))
    .openapi({
      description:
        "New display name. Send null (or an empty string) to clear it.",
    }),
})

export const UserProfileSchema = z
  .object({
    id: z.string(),
    email: z.email(),
    name: z.string(),
    role: z.enum(["user", "admin"]),
    displayName: z.string().nullable(),
  })
  .openapi("UserProfile")

export const getUserMeRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["Users"],
  summary: "Get current user",
  description: "Returns the authenticated user's profile",
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: "Current user profile",
      content: { "application/json": { schema: UserSchema } },
    },
    ...errorResponses({ 401: "Unauthorized", 500: "Internal server error" }),
  },
})

export const updateUserMeRoute = createRoute({
  method: "patch",
  path: "/me",
  tags: ["Users"],
  summary: "Update current user's profile",
  description: "Updates the authenticated user's display name",
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: UpdateUserMeBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Updated profile",
      content: { "application/json": { schema: UserProfileSchema } },
    },
    ...errorResponses({
      400: "Request validation failed (VALIDATION_ERROR). Malformed JSON body or schema mismatch.",
      401: "Unauthorized",
      500: "Unexpected internal server error (INTERNAL_ERROR).",
    }),
  },
})
