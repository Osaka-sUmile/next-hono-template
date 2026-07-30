import type { IFeedbackSurveyRepository } from "@workspace/domain"
import { FeedbackSurveyNotFoundError } from "../errors"
import { BaseCommandUseCase } from "./base.command"

export type DeleteFeedbackSurveyInput = { surveyId: string }

/** 非公開かつ提出 0 件の下書きだけを完全削除する。 */
export class DeleteFeedbackSurveyUseCase extends BaseCommandUseCase<
  DeleteFeedbackSurveyInput,
  void
> {
  constructor(
    private readonly feedbackSurveyRepository: IFeedbackSurveyRepository
  ) {
    super()
  }

  async execute({ surveyId }: DeleteFeedbackSurveyInput): Promise<void> {
    const survey = await this.feedbackSurveyRepository.findById(surveyId)
    if (!survey) {
      throw new FeedbackSurveyNotFoundError(surveyId)
    }
    await this.feedbackSurveyRepository.delete(survey)
  }
}
