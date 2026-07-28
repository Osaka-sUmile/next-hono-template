import type { IFeedbackQueryService } from "@workspace/domain";
import type { FeedbackSurveyResponseDto } from "../dtos";
import { ActiveFeedbackSurveyNotFoundError } from "../errors";
import { BaseQueryUseCase } from "./base.query";

/**
 * 公開中のアンケートを設問・選択肢込みで取得する Query ユースケース。
 *
 * 参照のみなので Repository ではなく QueryService を使い、Entity の復元は行わない。
 * 公開中アンケートが存在しない場合は DTO を組み立てられないため、
 * null を返さず ApplicationError を送出して Presentation 層で 404 に変換する。
 */
export class GetActiveFeedbackSurveyUseCase extends BaseQueryUseCase<
  void,
  FeedbackSurveyResponseDto
> {
  constructor(private readonly feedbackQueryService: IFeedbackQueryService) {
    super();
  }

  async execute(): Promise<FeedbackSurveyResponseDto> {
    const survey = await this.feedbackQueryService.findActiveSurveyView();
    if (!survey) {
      throw new ActiveFeedbackSurveyNotFoundError();
    }

    return {
      id: survey.id,
      slug: survey.slug,
      title: survey.title,
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
    };
  }
}
