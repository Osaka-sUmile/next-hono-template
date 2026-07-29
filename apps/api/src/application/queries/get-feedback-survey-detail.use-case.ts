import type { IFeedbackQueryService } from "@workspace/domain"
import type { FeedbackSurveyDetailResponseDto } from "../dtos"
import { FeedbackSurveyNotFoundError } from "../errors"
import { BaseQueryUseCase } from "./base.query"

export type GetFeedbackSurveyDetailInput = {
  surveyId: string
}

/**
 * 管理者向けに 1 件のアンケートを設問・選択肢込みで取得する Query ユースケース。
 *
 * 集計 API（summary）は設問文も選択肢ラベルも返さないため、グラフ描画は
 * この詳細と突き合わせて行う。存在しない id は DTO を組み立てられないので
 * null を返さず ApplicationError を送出し、Presentation 層で 404 に変換する。
 */
export class GetFeedbackSurveyDetailUseCase extends BaseQueryUseCase<
  GetFeedbackSurveyDetailInput,
  FeedbackSurveyDetailResponseDto
> {
  constructor(private readonly feedbackQueryService: IFeedbackQueryService) {
    super()
  }

  async execute({
    surveyId,
  }: GetFeedbackSurveyDetailInput): Promise<FeedbackSurveyDetailResponseDto> {
    const survey =
      await this.feedbackQueryService.findSurveyDetailById(surveyId)
    if (!survey) {
      throw new FeedbackSurveyNotFoundError(surveyId)
    }

    return {
      id: survey.id,
      slug: survey.slug,
      title: survey.title,
      isActive: survey.isActive,
      createdAt: survey.createdAt,
      questions: survey.questions.map((question) => ({
        id: question.id,
        type: question.type,
        text: question.text,
        required: question.required,
        sortOrder: question.sortOrder,
        choices: question.choices.map((choice) => ({
          value: choice.value,
          label: choice.label,
          sortOrder: choice.sortOrder,
        })),
      })),
    }
  }
}
