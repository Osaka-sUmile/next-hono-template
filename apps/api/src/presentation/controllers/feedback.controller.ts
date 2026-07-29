import type { RouteHandler } from "@hono/zod-openapi"
import {
  ActiveFeedbackSurveyNotFoundError,
  InvalidFeedbackAnswerError,
} from "../../application"
import type {
  GetActiveFeedbackSurveyUseCase,
  ListFeedbackSubmissionsUseCase,
  SubmitFeedbackUseCase,
  SummarizeFeedbackUseCase,
} from "../../application"
import type { AppEnv } from "../app-env"
import { ErrorCodes } from "../errors"
import { errorResponse } from "../http"
import type {
  getActiveFeedbackSurveyRoute,
  listFeedbackSubmissionsRoute,
  submitFeedbackRoute,
  summarizeFeedbackRoute,
} from "../routes"

export class FeedbackController {
  constructor(
    private readonly getActiveFeedbackSurveyUseCase: GetActiveFeedbackSurveyUseCase,
    private readonly submitFeedbackUseCase: SubmitFeedbackUseCase,
    private readonly listFeedbackSubmissionsUseCase: ListFeedbackSubmissionsUseCase,
    private readonly summarizeFeedbackUseCase: SummarizeFeedbackUseCase
  ) {}

  // GET /feedback/survey: 回答フォームを描画するための設問一覧。
  getActiveSurvey: RouteHandler<typeof getActiveFeedbackSurveyRoute, AppEnv> =
    async (c) => {
      try {
        const survey = await this.getActiveFeedbackSurveyUseCase.execute()
        return c.json(survey, 200)
      } catch (error) {
        if (error instanceof ActiveFeedbackSurveyNotFoundError) {
          return errorResponse(
            c,
            404,
            ErrorCodes.FEEDBACK_SURVEY_NOT_FOUND,
            error.message
          )
        }
        throw error
      }
    }

  // POST /feedback/submissions: 投稿者は必ず認証セッションから決める（ボディの値は使わない）。
  submitFeedback: RouteHandler<typeof submitFeedbackRoute, AppEnv> = async (
    c
  ) => {
    // auth は requireAuth が非 null を保証して c.set するため、ここでの再検証はしない。
    const { user } = c.get("auth")
    const { answers } = c.req.valid("json")

    try {
      const accepted = await this.submitFeedbackUseCase.execute({
        userId: user.id,
        answers,
      })
      return c.json(accepted, 201)
    } catch (error) {
      if (error instanceof ActiveFeedbackSurveyNotFoundError) {
        return errorResponse(
          c,
          404,
          ErrorCodes.FEEDBACK_SURVEY_NOT_FOUND,
          error.message
        )
      }
      if (error instanceof InvalidFeedbackAnswerError) {
        return errorResponse(
          c,
          400,
          ErrorCodes.FEEDBACK_INVALID_ANSWER,
          error.message
        )
      }
      // 想定外エラーは中央エラーハンドラ (onError) に委譲し、ログ・Sentry 送信を一元化する。
      throw error
    }
  }

  // GET /admin/feedback/submissions: 回答者の氏名・メール・自由記述を含むため admin 限定。
  listSubmissions: RouteHandler<typeof listFeedbackSubmissionsRoute, AppEnv> =
    async (c) => {
      const { limit, offset, surveyId } = c.req.valid("query")
      const result = await this.listFeedbackSubmissionsUseCase.execute({
        limit,
        offset,
        ...(surveyId === undefined ? {} : { surveyId }),
      })
      return c.json(result, 200)
    }

  // GET /admin/feedback/summary: 選択式設問の集計（ユーザーごと最新提出のみ）。
  getSummary: RouteHandler<typeof summarizeFeedbackRoute, AppEnv> = async (
    c
  ) => {
    const { surveyId } = c.req.valid("query")
    const summary = await this.summarizeFeedbackUseCase.execute({ surveyId })
    return c.json(summary, 200)
  }
}
