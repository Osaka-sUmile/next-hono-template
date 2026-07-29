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
   *
   * id ではなく Entity を受け取るのは、`activate()` の公開可能性チェックを迂回して
   * 設問 0 件のアンケートを有効化されるのを防ぐため。それを許すと `findActive()` の
   * `reconstitute` が常に失敗し、回答者向けフォームが壊れる。
   * 引数には `activate()` を通した公開可能な Entity を渡すこと。
   * 実装側も永続化状態に対して同じ事前条件を検証し、違反時は
   * `EmptyActiveFeedbackSurveyError` を投げて有効化を行わない。
   */
  activateExclusively(entity: FeedbackSurveyEntity): Promise<void>
}
