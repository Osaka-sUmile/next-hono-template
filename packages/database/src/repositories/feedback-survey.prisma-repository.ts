import { Prisma, PrismaClient } from "@prisma/client";
import {
  FeedbackChoice,
  FeedbackQuestionEntity,
  FeedbackSurveyEntity,
  IFeedbackSurveyRepository,
  parseFeedbackQuestionType,
} from "@workspace/domain";

type FeedbackSurveyWithQuestions = Prisma.FeedbackSurveyGetPayload<{
  include: {
    questions: {
      include: {
        choices: true;
      };
    };
  };
}>;

export class FeedbackSurveyPrismaRepository implements IFeedbackSurveyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findActive(): Promise<FeedbackSurveyEntity | null> {
    const survey = await this.prisma.feedbackSurvey.findFirst({
      where: { isActive: true },
      include: {
        questions: {
          include: {
            choices: {
              orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            },
          },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (!survey) return null;
    return this.toDomain(survey);
  }

  private toDomain(model: FeedbackSurveyWithQuestions): FeedbackSurveyEntity {
    try {
      const questions = model.questions.map((question) =>
        FeedbackQuestionEntity.reconstitute(
          question.id,
          parseFeedbackQuestionType(question.type),
          question.text,
          question.required,
          question.sortOrder,
          question.choices.map((choice) =>
            FeedbackChoice.reconstitute(
              choice.id,
              choice.value,
              choice.label,
              choice.sortOrder
            )
          )
        )
      );
      return FeedbackSurveyEntity.reconstitute(
        model.id,
        model.slug,
        model.title,
        model.isActive,
        questions
      );
    } catch (error) {
      throw new Error(
        `Failed to reconstitute FeedbackSurveyEntity (id=${model.id})`,
        {
          cause: error,
        }
      );
    }
  }
}
