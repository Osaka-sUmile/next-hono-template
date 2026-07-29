import { FeedbackQuestionType } from "../models"

export type FeedbackChoiceView = {
  value: string
  label: string
  sortOrder: number
}

export type FeedbackQuestionView = {
  id: string
  type: FeedbackQuestionType
  text: string
  required: boolean
  sortOrder: number
  choices: FeedbackChoiceView[]
}

export type FeedbackSurveyView = {
  id: string
  slug: string
  title: string
  questions: FeedbackQuestionView[]
}

/**
 * 管理者向けのアンケート一覧の 1 行。
 * 設問・選択肢は一覧では返さず、件数のみを持つ。
 */
export type FeedbackSurveyListItemView = {
  id: string
  slug: string
  title: string
  isActive: boolean
  questionCount: number
  submissionCount: number
  createdAt: Date
}

/**
 * 管理者向けのアンケート詳細。
 * 回答者向けの FeedbackSurveyView とは別型にする。あちらは公開状態や作成時刻を
 * 意図的に持たないので、管理用途のために広げてはならない。
 */
export type FeedbackSurveyDetailView = {
  id: string
  slug: string
  title: string
  isActive: boolean
  createdAt: Date
  questions: FeedbackQuestionView[]
}

export type FeedbackSubmissionUserView = {
  id: string
  email: string
  name: string
  displayName: string | null
}

export type FeedbackSubmissionAnswerView = {
  questionId: string
  questionText: string
  choiceValue: string | null
  choiceLabel: string | null
  textValue: string | null
}

export type FeedbackSubmissionView = {
  id: string
  surveyId: string
  user: FeedbackSubmissionUserView
  createdAt: Date
  answers: FeedbackSubmissionAnswerView[]
}

export type FeedbackSubmissionListParams = {
  limit: number
  offset: number
  /** 指定時はそのアンケートの提出のみを対象にする。未指定なら全アンケートを横断する。 */
  surveyId?: string
}

export type FeedbackSubmissionListResult = {
  items: FeedbackSubmissionView[]
  total: number
}

export type FeedbackChoiceTally = {
  questionId: string
  choiceValue: string
  count: number
}

export type FeedbackSummaryTallyResult = {
  respondentCount: number
  tallies: FeedbackChoiceTally[]
}

export interface IFeedbackQueryService {
  findActiveSurveyView(): Promise<FeedbackSurveyView | null>
  /** 管理者向けにアンケートを新しい順で一覧する。公開・非公開の両方を含む。 */
  listSurveys(): Promise<FeedbackSurveyListItemView[]>
  /** 該当 id のアンケートが存在しなければ null を返す。 */
  findSurveyDetailById(
    surveyId: string
  ): Promise<FeedbackSurveyDetailView | null>
  listSubmissions(
    params: FeedbackSubmissionListParams
  ): Promise<FeedbackSubmissionListResult>
  summarize(surveyId: string): Promise<FeedbackSummaryTallyResult>
}
