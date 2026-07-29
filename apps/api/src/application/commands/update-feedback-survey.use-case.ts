import type {
  FeedbackSurveyEntity,
  IFeedbackSurveyRepository,
} from "@workspace/domain"
import type { FeedbackSurveyMutationResponseDto } from "../dtos/feedback.response.dto"
import { FeedbackSurveyNotFoundError } from "../errors/feedback.error"
import { BaseCommandUseCase } from "./base.command"

export type UpdateFeedbackSurveyInput = {
  surveyId: string
  slug?: string
  title?: string
  isActive?: boolean
}

function toMutationDto(
  survey: FeedbackSurveyEntity
): FeedbackSurveyMutationResponseDto {
  return {
    id: survey.id,
    slug: survey.slug,
    title: survey.title,
    isActive: survey.isActive,
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

/**
 * 管理者がアンケートのスカラー項目を部分更新する Command ユースケース。
 *
 * save() 成功後に activateExclusively() が失敗すると複数アクティブが残りうるが、
 * findActive() は createdAt / id で決定的に解決するため既知リスクとして受容する。
 * PR11 で設問削除を追加する際に、トランザクションまたは部分ユニーク制約を再検討する。
 */
export class UpdateFeedbackSurveyUseCase extends BaseCommandUseCase<
  UpdateFeedbackSurveyInput,
  FeedbackSurveyMutationResponseDto
> {
  constructor(
    private readonly feedbackSurveyRepository: IFeedbackSurveyRepository
  ) {
    super()
  }

  async execute({
    surveyId,
    slug,
    title,
    isActive,
  }: UpdateFeedbackSurveyInput): Promise<FeedbackSurveyMutationResponseDto> {
    const survey = await this.feedbackSurveyRepository.findById(surveyId)
    if (!survey) {
      throw new FeedbackSurveyNotFoundError(surveyId)
    }

    let next = survey
    if (slug !== undefined) next = next.changeSlug(slug)
    if (title !== undefined) next = next.changeTitle(title)
    // activate() を save より先に通し、設問 0 件なら一切書き込まず失敗させる。
    if (isActive === true) next = next.activate()
    if (isActive === false) next = next.deactivate()

    // slug 衝突時に他アンケートを停止しないよう、排他化は save 成功後に行う。
    const saved = await this.feedbackSurveyRepository.save(next)
    if (isActive === true) {
      await this.feedbackSurveyRepository.activateExclusively(saved)
    }

    return toMutationDto(saved)
  }
}
