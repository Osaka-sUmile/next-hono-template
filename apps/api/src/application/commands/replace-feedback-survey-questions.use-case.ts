import type { IFeedbackSurveyRepository, IIdGenerator } from "@workspace/domain"
import type { FeedbackSurveyMutationResponseDto } from "../dtos/feedback.response.dto"
import { toFeedbackSurveyMutationResponseDto } from "../dtos/feedback.response.dto"
import { FeedbackSurveyNotFoundError } from "../errors"
import { BaseCommandUseCase } from "./base.command"
import type { FeedbackSurveyQuestionInput } from "./feedback-survey-question.input"
import { toQuestionDrafts } from "./feedback-survey-question.input"

export type ReplaceFeedbackSurveyQuestionsInput = {
  surveyId: string
  questions: readonly FeedbackSurveyQuestionInput[]
}

/** 非公開・提出 0 件の下書きについて、設問セット全体を置換する。 */
export class ReplaceFeedbackSurveyQuestionsUseCase extends BaseCommandUseCase<
  ReplaceFeedbackSurveyQuestionsInput,
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
    questions,
  }: ReplaceFeedbackSurveyQuestionsInput): Promise<FeedbackSurveyMutationResponseDto> {
    const current = await this.feedbackSurveyRepository.findById(surveyId)
    if (!current) {
      throw new FeedbackSurveyNotFoundError(surveyId)
    }

    // Entity で inactive を先に検証し、Repository がロック後に永続状態と提出件数を再検証する。
    const replacement = current.replaceQuestions(
      toQuestionDrafts(questions, this.idGenerator)
    )
    const saved =
      await this.feedbackSurveyRepository.replaceQuestions(replacement)
    if (!saved) {
      throw new FeedbackSurveyNotFoundError(surveyId)
    }
    return toFeedbackSurveyMutationResponseDto(saved)
  }
}
