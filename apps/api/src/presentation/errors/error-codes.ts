export const ErrorCodes = {
  // User errors
  USER_NOT_FOUND: "USER_NOT_FOUND",
  // Session errors
  SESSION_INVALID: "SESSION_INVALID",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  SESSION_FETCH_FAILED: "SESSION_FETCH_FAILED",
  // Authorization errors
  FORBIDDEN: "FORBIDDEN",
  // Feedback errors
  FEEDBACK_SURVEY_NOT_FOUND: "FEEDBACK_SURVEY_NOT_FOUND",
  FEEDBACK_INVALID_ANSWER: "FEEDBACK_INVALID_ANSWER",
  // Rate limit errors
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  // Validation errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  // Generic errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * エラーレスポンスの body 形状。OpenAPI の ErrorSchema（required: error, code）と一致させる。
 * この形の手組みを各所に散らさないよう、errorResponse ヘルパーの戻り値として一元管理する。
 */
export type ErrorResponseBody = { error: string; code: ErrorCode };
