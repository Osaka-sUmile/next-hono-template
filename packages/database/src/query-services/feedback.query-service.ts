import { PrismaClient } from "@prisma/client"
import {
  FeedbackChoiceTally,
  FeedbackSubmissionListParams,
  FeedbackSubmissionListResult,
  FeedbackSummaryTallyResult,
  FeedbackSurveyView,
  IFeedbackQueryService,
  parseFeedbackQuestionType,
} from "@workspace/domain"

type RawFeedbackChoiceTally = {
  questionId: string
  choiceValue: string
  count: number
}

type RawRespondentCount = {
  count: number
}

export class FeedbackQueryService implements IFeedbackQueryService {
  constructor(private readonly prisma: PrismaClient) {}

  async findActiveSurveyView(): Promise<FeedbackSurveyView | null> {
    const survey = await this.prisma.feedbackSurvey.findFirst({
      where: { isActive: true },
      select: {
        id: true,
        slug: true,
        title: true,
        createdAt: true,
        questions: {
          select: {
            id: true,
            type: true,
            text: true,
            required: true,
            sortOrder: true,
            choices: {
              select: {
                value: true,
                label: true,
                sortOrder: true,
                id: true,
              },
              orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            },
          },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    })
    if (!survey) return null

    try {
      return {
        id: survey.id,
        slug: survey.slug,
        title: survey.title,
        questions: survey.questions.map((question) => ({
          id: question.id,
          type: parseFeedbackQuestionType(question.type),
          text: question.text,
          required: question.required,
          sortOrder: question.sortOrder,
          choices: question.choices.map((choice) => ({
            value: choice.value,
            label: choice.label,
            sortOrder: choice.sortOrder,
          })),
        })),
      }
    } catch (error) {
      throw new Error(
        `Failed to map active feedback survey (id=${survey.id})`,
        {
          cause: error,
        }
      )
    }
  }

  async listSubmissions(
    params: FeedbackSubmissionListParams
  ): Promise<FeedbackSubmissionListResult> {
    const [total, submissions] = await this.prisma.$transaction([
      this.prisma.feedbackSubmission.count(),
      this.prisma.feedbackSubmission.findMany({
        select: {
          id: true,
          surveyId: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              displayName: true,
            },
          },
          answers: {
            select: {
              id: true,
              questionId: true,
              textValue: true,
              question: {
                select: {
                  text: true,
                  sortOrder: true,
                },
              },
              choice: {
                select: {
                  value: true,
                  label: true,
                },
              },
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: params.limit,
        skip: params.offset,
      }),
    ])

    return {
      total,
      items: submissions.map((submission) => ({
        id: submission.id,
        surveyId: submission.surveyId,
        user: submission.user,
        createdAt: submission.createdAt,
        answers: [...submission.answers]
          .sort(
            (left, right) =>
              left.question.sortOrder - right.question.sortOrder ||
              left.id.localeCompare(right.id)
          )
          .map((answer) => ({
            questionId: answer.questionId,
            questionText: answer.question.text,
            choiceValue: answer.choice?.value ?? null,
            choiceLabel: answer.choice?.label ?? null,
            textValue: answer.textValue,
          })),
      })),
    }
  }

  async summarize(surveyId: string): Promise<FeedbackSummaryTallyResult> {
    const [rawTallies, rawRespondentCounts] = await this.prisma.$transaction([
      this.prisma.$queryRaw<RawFeedbackChoiceTally[]>`
        WITH latest AS (
          SELECT DISTINCT ON ("userId") "id"
          FROM "FeedbackSubmission"
          WHERE "surveyId" = ${surveyId}
          ORDER BY "userId", "createdAt" DESC, "id" DESC
        )
        SELECT
          a."questionId",
          c."value" AS "choiceValue",
          COUNT(*)::int AS "count"
        FROM "FeedbackAnswer" a
        JOIN latest l ON l."id" = a."submissionId"
        JOIN "FeedbackChoice" c ON c."id" = a."choiceId"
        GROUP BY a."questionId", c."value"
        ORDER BY a."questionId", c."value"
      `,
      this.prisma.$queryRaw<RawRespondentCount[]>`
        WITH latest AS (
          SELECT DISTINCT ON ("userId") "id"
          FROM "FeedbackSubmission"
          WHERE "surveyId" = ${surveyId}
          ORDER BY "userId", "createdAt" DESC, "id" DESC
        )
        SELECT COUNT(*)::int AS "count"
        FROM latest
      `,
    ])

    const tallies: FeedbackChoiceTally[] = rawTallies.map((tally) => ({
      questionId: tally.questionId,
      choiceValue: tally.choiceValue,
      count: tally.count,
    }))
    return {
      respondentCount: rawRespondentCounts[0]?.count ?? 0,
      tallies,
    }
  }
}
