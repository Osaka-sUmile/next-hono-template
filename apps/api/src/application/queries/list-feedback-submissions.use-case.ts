import type { IFeedbackQueryService } from "@workspace/domain"
import type { FeedbackSubmissionListResponseDto } from "../dtos"
import { BaseQueryUseCase } from "./base.query"

export type ListFeedbackSubmissionsInput = {
  limit: number
  offset: number
  /** 未指定なら全アンケートを横断する。 */
  surveyId?: string
}

/**
 * 管理者向けに提出を新しい順で一覧する Query ユースケース。
 *
 * limit / offset の上限は Presentation 層の Zod スキーマで担保するため、ここでは
 * 受け取った値をそのまま QueryService へ渡す。レスポンスにページング値を含めて
 * 返すことで、呼び出し側が次ページの有無を total と突き合わせて判断できるようにする。
 */
export class ListFeedbackSubmissionsUseCase extends BaseQueryUseCase<
  ListFeedbackSubmissionsInput,
  FeedbackSubmissionListResponseDto
> {
  constructor(private readonly feedbackQueryService: IFeedbackQueryService) {
    super()
  }

  async execute({
    limit,
    offset,
    surveyId,
  }: ListFeedbackSubmissionsInput): Promise<FeedbackSubmissionListResponseDto> {
    const { items, total } = await this.feedbackQueryService.listSubmissions({
      limit,
      offset,
      ...(surveyId === undefined ? {} : { surveyId }),
    })

    return { items, total, limit, offset }
  }
}
