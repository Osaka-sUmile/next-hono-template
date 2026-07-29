import type { Hook } from "@hono/zod-openapi"
import { logger } from "../../infrastructure"
import type { AppEnv } from "../app-env"
import { ErrorCodes } from "../errors"
import { errorResponse, formatZodError } from "../http"

/** Map zValidator failures to the existing public error contract. */
export const validationErrorHook: Hook<
  unknown,
  AppEnv,
  string,
  Response | void
> = (result, c) => {
  if (!result.success) {
    logger.info(
      { err: result.error },
      "[validationHook] Request validation failed"
    )
    return errorResponse(
      c,
      400,
      ErrorCodes.VALIDATION_ERROR,
      formatZodError(result.error)
    )
  }
}
