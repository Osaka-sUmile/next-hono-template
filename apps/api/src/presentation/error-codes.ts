export const ErrorCodes = {
  // User errors
  USER_NOT_FOUND: "USER_NOT_FOUND",
  // Session errors
  SESSION_INVALID: "SESSION_INVALID",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  SESSION_FETCH_FAILED: "SESSION_FETCH_FAILED",
  // Authorization errors
  FORBIDDEN: "FORBIDDEN",
  // Rate limit errors
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  // Generic errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
