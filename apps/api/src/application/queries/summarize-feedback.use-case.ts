import type { IFeedbackQueryService } from "@workspace/domain";
import type { FeedbackSummaryResponseDto } from "../dtos";
import { BaseQueryUseCase } from "./base.query";

export type SummarizeFeedbackInput = {
  surveyId: string;
};

/**
 * 管理者向けに選択式設問を集計する Query ユースケース。
 *
 * 「ユーザーごとに最新の提出 1 件のみ採用する」という集計仕様は QueryService の
 * SQL 側（DISTINCT ON）が担保する。ここではその結果に問い合わせた surveyId を
 * 添えて返し、複数アンケートを扱う画面が結果の対象を取り違えないようにする。
 */
export class SummarizeFeedbackUseCase extends BaseQueryUseCase<
  SummarizeFeedbackInput,
  FeedbackSummaryResponseDto
> {
  constructor(private readonly feedbackQueryService: IFeedbackQueryService) {
    super();
  }

  async execute({ surveyId }: SummarizeFeedbackInput): Promise<FeedbackSummaryResponseDto> {
    const { respondentCount, tallies } = await this.feedbackQueryService.summarize(surveyId);
    return { surveyId, respondentCount, tallies };
  }
}
