import { ApplicationError } from "./application.error"

/**
 * 公開中（isActive）のアンケートが 1 件も存在しない状態。
 *
 * 運用でアンケートを停止している間は正常に起こりうるため、内部障害ではなく
 * 404 として返す（Presentation 層で FEEDBACK_SURVEY_NOT_FOUND へ変換する）。
 */
export class ActiveFeedbackSurveyNotFoundError extends ApplicationError {
  constructor() {
    super("No active feedback survey is available")
  }
}

/** 回答が公開中アンケートの業務ルールを満たさず、利用者による修正が必要な状態。 */
export class InvalidFeedbackAnswerError extends ApplicationError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
  }
}
