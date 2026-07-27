import { FeedbackSurveyEntity } from "../models";

export interface IFeedbackSurveyRepository {
  findActive(): Promise<FeedbackSurveyEntity | null>;
}
