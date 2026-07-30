import type { RouteHandler } from "@hono/zod-openapi"
import type { Context } from "hono"
import {
  DuplicateFeedbackAnswerError,
  EmptyActiveFeedbackSurveyError,
  FeedbackAnswerTypeMismatchError,
  FeedbackSurveyHasSubmissionsError,
  FeedbackSurveyMustBeInactiveError,
  FeedbackSurveySlugConflictError,
  FeedbackTextTooLongError,
  InvalidFeedbackChoiceError,
  RequiredFeedbackAnswerMissingError,
  UnknownFeedbackQuestionError,
} from "@workspace/domain"
import {
  ActiveFeedbackSurveyNotFoundError,
  FeedbackSurveyNotFoundError,
} from "../../application"
import type {
  CreateFeedbackSurveyUseCase,
  DeleteFeedbackSurveyUseCase,
  DuplicateFeedbackSurveyUseCase,
  GetActiveFeedbackSurveyUseCase,
  GetFeedbackSurveyDetailUseCase,
  ListFeedbackSubmissionsUseCase,
  ListFeedbackSurveysUseCase,
  ReplaceFeedbackSurveyQuestionsUseCase,
  SubmitFeedbackUseCase,
  SummarizeFeedbackUseCase,
  UpdateFeedbackSurveyUseCase,
} from "../../application"
import type { AppEnv } from "../app-env"
import { ErrorCodes } from "../errors"
import { errorResponse } from "../http"
import type {
  createFeedbackSurveyRoute,
  deleteFeedbackSurveyRoute,
  duplicateFeedbackSurveyRoute,
  getActiveFeedbackSurveyRoute,
  getFeedbackSurveyDetailRoute,
  listFeedbackSubmissionsRoute,
  listFeedbackSurveysRoute,
  replaceFeedbackSurveyQuestionsRoute,
  submitFeedbackRoute,
  summarizeFeedbackRoute,
  updateFeedbackSurveyRoute,
} from "../routes"

/**
 * 「送られた回答がアンケートの契約に合わない」ことを示すドメインエラー。
 * これらは利用者の入力起因の想定内エラーなので 400 FEEDBACK_INVALID_ANSWER に写す。
 *
 * DomainError を一律 400 に写さないのは意図的である。永続化データからの復元失敗
 * （InvalidArgumentError 等）も DomainError であり、それを 400 に丸めると
 * データ不整合という内部障害が利用者の入力不備として隠れてしまう。
 */
const ANSWER_CONTRACT_ERRORS = [
  DuplicateFeedbackAnswerError,
  FeedbackAnswerTypeMismatchError,
  FeedbackTextTooLongError,
  InvalidFeedbackChoiceError,
  RequiredFeedbackAnswerMissingError,
  UnknownFeedbackQuestionError,
] as const

function isAnswerContractError(error: unknown): error is Error {
  return ANSWER_CONTRACT_ERRORS.some(
    (errorClass) => error instanceof errorClass
  )
}

export class FeedbackController {
  constructor(
    private readonly getActiveFeedbackSurveyUseCase: GetActiveFeedbackSurveyUseCase,
    private readonly submitFeedbackUseCase: SubmitFeedbackUseCase,
    private readonly listFeedbackSurveysUseCase: ListFeedbackSurveysUseCase,
    private readonly getFeedbackSurveyDetailUseCase: GetFeedbackSurveyDetailUseCase,
    private readonly listFeedbackSubmissionsUseCase: ListFeedbackSubmissionsUseCase,
    private readonly summarizeFeedbackUseCase: SummarizeFeedbackUseCase,
    private readonly createFeedbackSurveyUseCase: CreateFeedbackSurveyUseCase,
    private readonly updateFeedbackSurveyUseCase: UpdateFeedbackSurveyUseCase,
    private readonly replaceFeedbackSurveyQuestionsUseCase: ReplaceFeedbackSurveyQuestionsUseCase,
    private readonly duplicateFeedbackSurveyUseCase: DuplicateFeedbackSurveyUseCase,
    private readonly deleteFeedbackSurveyUseCase: DeleteFeedbackSurveyUseCase
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
      if (isAnswerContractError(error)) {
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

  // GET /admin/feedback/surveys: 非公開アンケートも含む一覧。admin 限定。
  listSurveys: RouteHandler<typeof listFeedbackSurveysRoute, AppEnv> = async (
    c
  ) => {
    const surveys = await this.listFeedbackSurveysUseCase.execute()
    return c.json(surveys, 200)
  }

  // POST /admin/feedback/surveys: 設問・選択肢を含むアンケートを一括作成する。
  createSurvey: RouteHandler<typeof createFeedbackSurveyRoute, AppEnv> = async (
    c
  ) => {
    const body = c.req.valid("json")

    try {
      const survey = await this.createFeedbackSurveyUseCase.execute(body)
      return c.json(survey, 201)
    } catch (error) {
      if (error instanceof FeedbackSurveySlugConflictError) {
        return errorResponse(
          c,
          409,
          ErrorCodes.FEEDBACK_SURVEY_SLUG_CONFLICT,
          error.message
        )
      }
      if (error instanceof EmptyActiveFeedbackSurveyError) {
        return errorResponse(
          c,
          409,
          ErrorCodes.FEEDBACK_SURVEY_NOT_PUBLISHABLE,
          error.message
        )
      }
      // InvalidArgumentError を含むその他の DomainError は Zod ミラーの取りこぼし。
      // 400 に丸めず onError へ委譲し、500 + Sentry で検証境界のバグを観測する。
      throw error
    }
  }

  // GET /admin/feedback/surveys/{surveyId}: 集計グラフのラベル解決に使う設問付き詳細。
  getSurveyDetail: RouteHandler<typeof getFeedbackSurveyDetailRoute, AppEnv> =
    async (c) => {
      const { surveyId } = c.req.valid("param")

      try {
        const survey = await this.getFeedbackSurveyDetailUseCase.execute({
          surveyId,
        })
        return c.json(survey, 200)
      } catch (error) {
        if (error instanceof FeedbackSurveyNotFoundError) {
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

  // PATCH /admin/feedback/surveys/{surveyId}: スカラー項目のみを部分更新する。
  updateSurvey: RouteHandler<typeof updateFeedbackSurveyRoute, AppEnv> = async (
    c
  ) => {
    const { surveyId } = c.req.valid("param")
    const body = c.req.valid("json")

    try {
      const survey = await this.updateFeedbackSurveyUseCase.execute({
        surveyId,
        ...body,
      })
      return c.json(survey, 200)
    } catch (error) {
      if (error instanceof FeedbackSurveyNotFoundError) {
        return errorResponse(
          c,
          404,
          ErrorCodes.FEEDBACK_SURVEY_NOT_FOUND,
          error.message
        )
      }
      if (error instanceof FeedbackSurveySlugConflictError) {
        return errorResponse(
          c,
          409,
          ErrorCodes.FEEDBACK_SURVEY_SLUG_CONFLICT,
          error.message
        )
      }
      if (error instanceof EmptyActiveFeedbackSurveyError) {
        return errorResponse(
          c,
          409,
          ErrorCodes.FEEDBACK_SURVEY_NOT_PUBLISHABLE,
          error.message
        )
      }
      // InvalidArgumentError は route 側の不変条件ミラー漏れなので 500 として観測する。
      throw error
    }
  }

  // PATCH /admin/feedback/surveys/{surveyId}/questions: 未回答の下書きの設問を全置換する。
  replaceSurveyQuestions: RouteHandler<
    typeof replaceFeedbackSurveyQuestionsRoute,
    AppEnv
  > = async (c) => {
    const { surveyId } = c.req.valid("param")
    const { questions } = c.req.valid("json")
    try {
      const survey = await this.replaceFeedbackSurveyQuestionsUseCase.execute({
        surveyId,
        questions,
      })
      return c.json(survey, 200)
    } catch (error) {
      return this.handleDraftMutationError(c, error)
    }
  }

  // POST /admin/feedback/surveys/{surveyId}/duplicate: 新しい非公開surveyとして複製する。
  duplicateSurvey: RouteHandler<typeof duplicateFeedbackSurveyRoute, AppEnv> =
    async (c) => {
      const { surveyId } = c.req.valid("param")
      const body = c.req.valid("json")
      try {
        const survey = await this.duplicateFeedbackSurveyUseCase.execute({
          surveyId,
          ...body,
        })
        return c.json(survey, 201)
      } catch (error) {
        if (error instanceof FeedbackSurveySlugConflictError) {
          return errorResponse(
            c,
            409,
            ErrorCodes.FEEDBACK_SURVEY_SLUG_CONFLICT,
            error.message
          )
        }
        if (error instanceof FeedbackSurveyNotFoundError) {
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

  // DELETE /admin/feedback/surveys/{surveyId}: 未回答の下書きだけを完全削除する。
  deleteSurvey: RouteHandler<typeof deleteFeedbackSurveyRoute, AppEnv> = async (
    c
  ) => {
    const { surveyId } = c.req.valid("param")
    try {
      await this.deleteFeedbackSurveyUseCase.execute({ surveyId })
      return c.body(null, 204)
    } catch (error) {
      return this.handleDraftMutationError(c, error)
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

  private handleDraftMutationError(c: Context<AppEnv>, error: unknown) {
    if (error instanceof FeedbackSurveyNotFoundError) {
      return errorResponse(
        c,
        404,
        ErrorCodes.FEEDBACK_SURVEY_NOT_FOUND,
        error.message
      )
    }
    if (error instanceof FeedbackSurveyMustBeInactiveError) {
      return errorResponse(
        c,
        409,
        ErrorCodes.FEEDBACK_SURVEY_MUST_BE_INACTIVE,
        error.message
      )
    }
    if (error instanceof FeedbackSurveyHasSubmissionsError) {
      return errorResponse(
        c,
        409,
        ErrorCodes.FEEDBACK_SURVEY_HAS_SUBMISSIONS,
        error.message
      )
    }
    throw error
  }
}
