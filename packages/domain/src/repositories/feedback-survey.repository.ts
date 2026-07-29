import { FeedbackSurveyEntity } from "../models"
import { IRepository } from "./base.repository"

export interface IFeedbackSurveyRepository extends IRepository<
  FeedbackSurveyEntity,
  string
> {
  findActive(): Promise<FeedbackSurveyEntity | null>
  findBySlug(slug: string): Promise<FeedbackSurveyEntity | null>
  /**
   * 「同時にアクティブなのは 1 件」を保つため、対象を有効化し他をすべて無効化する。
   * 複数の集約ルートを跨ぐ操作なので `save(entity)` には収まらず、
   * Application 層は PrismaClient を受け取らないため Repository のメソッドとして公開する。
   */
  activateExclusively(id: string): Promise<void>
}
