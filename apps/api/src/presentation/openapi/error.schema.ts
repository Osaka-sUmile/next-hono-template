import { z } from "@hono/zod-openapi";
import { ErrorCodes } from "../errors";

/** Shared `{ error, code }` response schema, derived directly from ErrorCodes. */
export const ErrorSchema = z
  .object({
    error: z.string().openapi({ description: "Error message describing the issue" }),
    code: z.enum(ErrorCodes).openapi({
      description: [
        "Machine-readable error code for client-side handling.",
        "USER_NOT_FOUND (404) / SESSION_INVALID (401) / SESSION_EXPIRED (401) /",
        "SESSION_FETCH_FAILED (500) / FORBIDDEN (403) / RATE_LIMIT_EXCEEDED (429) /",
        "VALIDATION_ERROR (400) / INTERNAL_ERROR (500)",
      ].join(" "),
    }),
  })
  .openapi("Error");
