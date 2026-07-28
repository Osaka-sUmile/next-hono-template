import type {
  FeedbackChoiceTally,
  FeedbackQuestionType,
  FeedbackSubmissionView,
} from "@workspace/domain";

export type FeedbackChoiceResponseDto = {
  value: string;
  label: string;
  sortOrder: number;
};

export type FeedbackQuestionResponseDto = {
  id: string;
  type: FeedbackQuestionType;
  text: string;
  required: boolean;
  sortOrder: number;
  choices: FeedbackChoiceResponseDto[];
};

/** 回答フォーム描画用。回答者に見せる必要がない isActive 等は含めない。 */
export type FeedbackSurveyResponseDto = {
  id: string;
  slug: string;
  title: string;
  questions: FeedbackQuestionResponseDto[];
};

/** 回答投稿の受理結果。回答内容は投稿者に返し直さず、識別子と受理時刻のみ返す。 */
export type FeedbackSubmissionAcceptedResponseDto = {
  id: string;
  surveyId: string;
  createdAt: Date;
};

export type FeedbackSubmissionResponseDto = FeedbackSubmissionView;

export type FeedbackSubmissionListResponseDto = {
  items: FeedbackSubmissionResponseDto[];
  total: number;
  limit: number;
  offset: number;
};

/**
 * 選択式設問の集計結果。
 * 自由記述は集計対象外（提出一覧 API で個別に参照する）。
 */
export type FeedbackSummaryResponseDto = {
  surveyId: string;
  respondentCount: number;
  tallies: FeedbackChoiceTally[];
};
