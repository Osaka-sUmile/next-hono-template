import { FeedbackQuestionType } from "../models";

export type FeedbackChoiceView = {
  value: string;
  label: string;
  sortOrder: number;
};

export type FeedbackQuestionView = {
  id: string;
  type: FeedbackQuestionType;
  text: string;
  required: boolean;
  sortOrder: number;
  choices: FeedbackChoiceView[];
};

export type FeedbackSurveyView = {
  id: string;
  slug: string;
  title: string;
  questions: FeedbackQuestionView[];
};

export type FeedbackSubmissionUserView = {
  id: string;
  email: string;
  name: string;
  displayName: string | null;
};

export type FeedbackSubmissionAnswerView = {
  questionId: string;
  questionText: string;
  choiceValue: string | null;
  choiceLabel: string | null;
  textValue: string | null;
};

export type FeedbackSubmissionView = {
  id: string;
  surveyId: string;
  user: FeedbackSubmissionUserView;
  createdAt: Date;
  answers: FeedbackSubmissionAnswerView[];
};

export type FeedbackSubmissionListParams = {
  limit: number;
  offset: number;
  /** 指定時はそのアンケートの提出のみを対象にする。未指定なら全アンケートを横断する。 */
  surveyId?: string;
};

export type FeedbackSubmissionListResult = {
  items: FeedbackSubmissionView[];
  total: number;
};

export type FeedbackChoiceTally = {
  questionId: string;
  choiceValue: string;
  count: number;
};

export type FeedbackSummaryTallyResult = {
  respondentCount: number;
  tallies: FeedbackChoiceTally[];
};

export interface IFeedbackQueryService {
  findActiveSurveyView(): Promise<FeedbackSurveyView | null>;
  listSubmissions(
    params: FeedbackSubmissionListParams
  ): Promise<FeedbackSubmissionListResult>;
  summarize(surveyId: string): Promise<FeedbackSummaryTallyResult>;
}
