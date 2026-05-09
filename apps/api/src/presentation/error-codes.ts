export const ErrorCodes = {
  // User errors
  USER_NOT_FOUND: "USER_NOT_FOUND",
  // Session errors
  SESSION_INVALID: "SESSION_INVALID",
  SESSION_FETCH_FAILED: "SESSION_FETCH_FAILED",
  // Generic errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = "USER_NOT_FOUND" | "SESSION_INVALID" | "SESSION_FETCH_FAILED" | "INTERNAL_ERROR";
