import type {
  FeedbackChoiceTally,
  FeedbackQuestionType,
  FeedbackSubmissionView,
  FeedbackSurveyEntity,
} from "@workspace/domain"

export type FeedbackChoiceResponseDto = {
  value: string
  label: string
  sortOrder: number
}

export type FeedbackQuestionResponseDto = {
  id: string
  type: FeedbackQuestionType
  text: string
  required: boolean
  sortOrder: number
  choices: FeedbackChoiceResponseDto[]
}

/** 回答フォーム描画用。回答者に見せる必要がない isActive 等は含めない。 */
export type FeedbackSurveyResponseDto = {
  id: string
  slug: string
  title: string
  questions: FeedbackQuestionResponseDto[]
}

/** 管理者向けアンケート一覧の 1 行。設問本体は含めず件数のみ返す。 */
export type FeedbackSurveyListItemResponseDto = {
  id: string
  slug: string
  title: string
  isActive: boolean
  questionCount: number
  submissionCount: number
  createdAt: Date
}

export type FeedbackSurveyListResponseDto = {
  items: FeedbackSurveyListItemResponseDto[]
}

/** 管理者向けアンケート詳細。回答者向けの DTO と違い公開状態と作成時刻を含む。 */
export type FeedbackSurveyDetailResponseDto = {
  id: string
  slug: string
  title: string
  isActive: boolean
  createdAt: Date
  questions: FeedbackQuestionResponseDto[]
}

/**
 * Command（作成・更新）が返すアンケート DTO。
 * Query 系（FeedbackSurveyDetailResponseDto）と異なり createdAt を含まない。
 * Command は Repository が復元する FeedbackSurveyEntity のフィールドのみを扱い、
 * Entity は createdAt を保持しないため（UserProfileResponseDto と同じ理由）。
 */
export type FeedbackSurveyMutationResponseDto = {
  id: string
  slug: string
  title: string
  isActive: boolean
  questions: FeedbackQuestionResponseDto[]
}

/** Command use-case 共通の Entity → response DTO 変換。 */
export function toFeedbackSurveyMutationResponseDto(
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

/** 回答投稿の受理結果。回答内容は投稿者に返し直さず、識別子と受理時刻のみ返す。 */
export type FeedbackSubmissionAcceptedResponseDto = {
  id: string
  surveyId: string
  createdAt: Date
}

export type FeedbackSubmissionResponseDto = FeedbackSubmissionView

export type FeedbackSubmissionListResponseDto = {
  items: FeedbackSubmissionResponseDto[]
  total: number
  limit: number
  offset: number
}

/**
 * 選択式設問の集計結果。
 * 自由記述は集計対象外（提出一覧 API で個別に参照する）。
 */
export type FeedbackSummaryResponseDto = {
  surveyId: string
  respondentCount: number
  tallies: FeedbackChoiceTally[]
}
