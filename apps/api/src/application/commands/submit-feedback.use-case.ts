import { FeedbackSubmissionEntity } from "@workspace/domain";
import type {
  FeedbackAnswerInput,
  IFeedbackSubmissionRepository,
  IFeedbackSurveyRepository,
  IIdGenerator,
} from "@workspace/domain";
import type { FeedbackSubmissionAcceptedResponseDto } from "../dtos";
import { ActiveFeedbackSurveyNotFoundError } from "../errors";
import { BaseCommandUseCase } from "./base.command";

export type SubmitFeedbackInput = {
  /** 認証済みセッションの user.id。リクエストボディからは受け取らない。 */
  userId: string;
  answers: readonly FeedbackAnswerInput[];
};

/**
 * 公開中アンケートへ回答を投稿する Command ユースケース。
 *
 * 回答の妥当性（未知の設問・重複回答・必須未回答・選択肢の所属・種別の不一致・
 * 自由記述の長さ）は FeedbackSubmissionEntity.create が検証するため、ここでは
 * 「公開中アンケートを引く → Entity を作る → 保存する」というフロー制御のみを担う。
 *
 * 提出の書き込みは 1 集約（提出＋回答）に閉じており、Prisma のネスト書き込みが
 * 単一トランザクションで実行されるため、ここで $transaction は張らない。
 */
export class SubmitFeedbackUseCase extends BaseCommandUseCase<
  SubmitFeedbackInput,
  FeedbackSubmissionAcceptedResponseDto
> {
  constructor(
    private readonly feedbackSurveyRepository: IFeedbackSurveyRepository,
    private readonly feedbackSubmissionRepository: IFeedbackSubmissionRepository,
    private readonly idGenerator: IIdGenerator,
  ) {
    super();
  }

  async execute({
    userId,
    answers,
  }: SubmitFeedbackInput): Promise<FeedbackSubmissionAcceptedResponseDto> {
    const survey = await this.feedbackSurveyRepository.findActive();
    if (!survey) {
      throw new ActiveFeedbackSurveyNotFoundError();
    }

    const submission = FeedbackSubmissionEntity.create(
      this.idGenerator.generate(),
      survey,
      userId,
      answers,
    );
    const saved = await this.feedbackSubmissionRepository.save(submission);

    return {
      id: saved.id,
      surveyId: saved.surveyId,
      createdAt: saved.createdAt,
    };
  }
}
