import type { IFeedbackSurveyRepository } from "@workspace/domain"
import type { FeedbackSurveyMutationResponseDto } from "../dtos/feedback.response.dto"
import { toFeedbackSurveyMutationResponseDto } from "../dtos/feedback.response.dto"
import { FeedbackSurveyNotFoundError } from "../errors/feedback.error"
import { BaseCommandUseCase } from "./base.command"

export type UpdateFeedbackSurveyInput = {
  surveyId: string
  slug?: string
  title?: string
  isActive?: boolean
}

/**
 * 管理者がアンケートのスカラー項目を部分更新する Command ユースケース。
 *
 * update() 成功後に activateExclusively() が失敗すると複数アクティブが残りうるが、
 * findActive() は createdAt / id で決定的に解決するため既知リスクとして受容する。
 * 原子的な保存・有効化と並行実行時の排他制御は issue #157 で扱う。
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
    // activate() を update より先に通し、設問 0 件なら一切書き込まず失敗させる。
    if (isActive === true) next = next.activate()
    if (isActive === false) next = next.deactivate()

    // slug 衝突時に他アンケートを停止しないよう、排他化は update 成功後に行う。
    const saved = await this.feedbackSurveyRepository.update(next)
    if (!saved) {
      throw new FeedbackSurveyNotFoundError(surveyId)
    }
    if (isActive === true) {
      await this.feedbackSurveyRepository.activateExclusively(saved)
    }

    return toFeedbackSurveyMutationResponseDto(saved)
  }
}
