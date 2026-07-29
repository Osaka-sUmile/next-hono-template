import type { IFeedbackQueryService } from "@workspace/domain"
import type { FeedbackSurveyListResponseDto } from "../dtos"
import { BaseQueryUseCase } from "./base.query"

/**
 * 管理者向けにアンケートを一覧する Query ユースケース。
 *
 * アンケートは運用上ごく少数なのでページングは持たせない。将来 total や
 * limit/offset を足しても壊れないよう、配列を直に返さず envelope で包む。
 */
export class ListFeedbackSurveysUseCase extends BaseQueryUseCase<
  void,
  FeedbackSurveyListResponseDto
> {
  constructor(private readonly feedbackQueryService: IFeedbackQueryService) {
    super()
  }

  async execute(): Promise<FeedbackSurveyListResponseDto> {
    const surveys = await this.feedbackQueryService.listSurveys()

    return {
      items: surveys.map((survey) => ({
        id: survey.id,
        slug: survey.slug,
        title: survey.title,
        isActive: survey.isActive,
        questionCount: survey.questionCount,
        submissionCount: survey.submissionCount,
        createdAt: survey.createdAt,
      })),
    }
  }
}
