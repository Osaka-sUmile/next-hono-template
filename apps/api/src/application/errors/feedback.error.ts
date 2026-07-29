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

/**
 * 指定された id のアンケートが存在しない状態。
 *
 * 管理者が削除済み・誤りの id を指定した場合に起こるため 404 として返す
 * （Presentation 層で FEEDBACK_SURVEY_NOT_FOUND へ変換する）。
 * id は管理者しか見ないうえ推測不能な識別子なので、メッセージに含めて調査可能にする。
 */
export class FeedbackSurveyNotFoundError extends ApplicationError {
  constructor(surveyId: string) {
    super(`Feedback survey not found: surveyId="${surveyId}"`)
  }
}
