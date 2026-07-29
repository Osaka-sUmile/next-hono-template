import { FeedbackSubmissionEntity } from "../models"
import { IRepository } from "./base.repository"

export type IFeedbackSubmissionRepository = IRepository<
  FeedbackSubmissionEntity,
  string
>
