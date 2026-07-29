import { z } from "@hono/zod-openapi"
import { ErrorCodes } from "../errors"

/** Shared `{ error, code }` response schema, derived directly from ErrorCodes. */
export const ErrorSchema = z
  .object({
    error: z
      .string()
      .openapi({ description: "Error message describing the issue" }),
    code: z.enum(ErrorCodes).openapi({
      description: "Machine-readable error code for client-side handling.",
    }),
  })
  .openapi("Error")
