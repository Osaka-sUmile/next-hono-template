import { Prisma, PrismaClient } from "@prisma/client"
import {
  FeedbackSubmissionEntity,
  IFeedbackSubmissionRepository,
} from "@workspace/domain"

type FeedbackSubmissionWithAnswers = Prisma.FeedbackSubmissionGetPayload<{
  include: {
    answers: true
  }
}>

export class FeedbackSubmissionPrismaRepository implements IFeedbackSubmissionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<FeedbackSubmissionEntity | null> {
    const submission = await this.prisma.feedbackSubmission.findUnique({
      where: { id },
      include: {
        answers: {
          orderBy: [{ questionId: "asc" }, { id: "asc" }],
        },
      },
    })
    if (!submission) return null
    return this.toDomain(submission)
  }

  async save(
    entity: FeedbackSubmissionEntity
  ): Promise<FeedbackSubmissionEntity> {
    const answers = entity.answers.map((answer) => ({
      questionId: answer.questionId,
      choiceId: answer.choiceId,
      textValue: answer.textValue,
    }))
    const submission = await this.prisma.feedbackSubmission.upsert({
      where: { id: entity.id },
      update: {
        surveyId: entity.surveyId,
        userId: entity.userId,
        answers: {
          deleteMany: {},
          create: answers,
        },
      },
      create: {
        id: entity.id,
        surveyId: entity.surveyId,
        userId: entity.userId,
        createdAt: entity.createdAt,
        answers: {
          create: answers,
        },
      },
      include: {
        answers: {
          orderBy: [{ questionId: "asc" }, { id: "asc" }],
        },
      },
    })
    return this.toDomain(submission)
  }

  async delete(entity: FeedbackSubmissionEntity): Promise<void> {
    await this.prisma.feedbackSubmission.delete({ where: { id: entity.id } })
  }

  private toDomain(
    model: FeedbackSubmissionWithAnswers
  ): FeedbackSubmissionEntity {
    try {
      return FeedbackSubmissionEntity.reconstitute(
        model.id,
        model.surveyId,
        model.userId,
        model.answers.map((answer) => ({
          questionId: answer.questionId,
          choiceId: answer.choiceId,
          textValue: answer.textValue,
        })),
        model.createdAt
      )
    } catch (error) {
      throw new Error(
        `Failed to reconstitute FeedbackSubmissionEntity (id=${model.id})`,
        {
          cause: error,
        }
      )
    }
  }
}
