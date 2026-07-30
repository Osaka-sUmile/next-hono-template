import { FeedbackSurveyEntity } from "@workspace/domain"
import type { IFeedbackSurveyRepository, IIdGenerator } from "@workspace/domain"
import type { FeedbackSurveyMutationResponseDto } from "../dtos/feedback.response.dto"
import { toFeedbackSurveyMutationResponseDto } from "../dtos/feedback.response.dto"
import { BaseCommandUseCase } from "./base.command"
import type { FeedbackSurveyQuestionInput } from "./feedback-survey-question.input"
import { toQuestionDrafts } from "./feedback-survey-question.input"

export type CreateFeedbackSurveyInput = {
  slug: string
  title: string
  isActive: boolean
  questions: readonly FeedbackSurveyQuestionInput[]
}

/** 管理者がアンケートと設問・選択肢を一括作成する Command ユースケース。 */
export class CreateFeedbackSurveyUseCase extends BaseCommandUseCase<
  CreateFeedbackSurveyInput,
  FeedbackSurveyMutationResponseDto
> {
  constructor(
    private readonly feedbackSurveyRepository: IFeedbackSurveyRepository,
    private readonly idGenerator: IIdGenerator
  ) {
    super()
  }

  async execute({
    slug,
    title,
    isActive,
    questions,
  }: CreateFeedbackSurveyInput): Promise<FeedbackSurveyMutationResponseDto> {
    // 全階層の id はサーバーで採番し、sortOrder は Entity が配列順から導出する。
    const survey = FeedbackSurveyEntity.create({
      id: this.idGenerator.generate(),
      slug,
      title,
      isActive,
      questions: toQuestionDrafts(questions, this.idGenerator),
    })

    // slug 衝突など入力起因で失敗しうる save を、集約を跨ぐ排他化より先に行う。
    const saved = await this.feedbackSurveyRepository.save(survey)
    if (isActive) {
      await this.feedbackSurveyRepository.activateExclusively(saved)
    }

    return toFeedbackSurveyMutationResponseDto(saved)
  }
}
