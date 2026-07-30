import { FeedbackSurveyEntity } from "@workspace/domain"
import type { IFeedbackSurveyRepository, IIdGenerator } from "@workspace/domain"
import type { FeedbackSurveyMutationResponseDto } from "../dtos/feedback.response.dto"
import { toFeedbackSurveyMutationResponseDto } from "../dtos/feedback.response.dto"
import { FeedbackSurveyNotFoundError } from "../errors"
import { BaseCommandUseCase } from "./base.command"
import { toQuestionDrafts } from "./feedback-survey-question.input"

export type DuplicateFeedbackSurveyInput = {
  surveyId: string
  slug: string
  title: string
}

/**
 * 回答済みアンケートを含む任意のアンケートから、設問構成だけを新しい非公開surveyへ複製する。
 * submission・answer と source lineage は引き継がない。
 */
export class DuplicateFeedbackSurveyUseCase extends BaseCommandUseCase<
  DuplicateFeedbackSurveyInput,
  FeedbackSurveyMutationResponseDto
> {
  constructor(
    private readonly feedbackSurveyRepository: IFeedbackSurveyRepository,
    private readonly idGenerator: IIdGenerator
  ) {
    super()
  }

  async execute({
    surveyId,
    slug,
    title,
  }: DuplicateFeedbackSurveyInput): Promise<FeedbackSurveyMutationResponseDto> {
    const source = await this.feedbackSurveyRepository.findById(surveyId)
    if (!source) {
      throw new FeedbackSurveyNotFoundError(surveyId)
    }

    const duplicate = FeedbackSurveyEntity.create({
      id: this.idGenerator.generate(),
      slug,
      title,
      isActive: false,
      questions: toQuestionDrafts(
        source.questions.map((question) => ({
          type: question.type,
          text: question.text,
          required: question.required,
          choices: question.choices.map((choice) => ({
            value: choice.value,
            label: choice.label,
          })),
        })),
        this.idGenerator
      ),
    })
    const saved = await this.feedbackSurveyRepository.insert(duplicate)
    return toFeedbackSurveyMutationResponseDto(saved)
  }
}
