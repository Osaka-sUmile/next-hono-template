import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { FeedbackQueryService } from "./feedback.query-service"
import { createTestPrismaClient, resetDatabase } from "../test-utils"

describe("FeedbackQueryService (integration)", () => {
  let prisma: PrismaClient
  let queryService: FeedbackQueryService

  beforeAll(() => {
    prisma = createTestPrismaClient()
    queryService = new FeedbackQueryService(prisma)
  })

  beforeEach(async () => {
    await resetDatabase(prisma)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  async function seedSurvey(): Promise<void> {
    await prisma.feedbackSurvey.create({
      data: {
        id: "survey-1",
        slug: "pmf-2026",
        title: "PMFアンケート",
        isActive: true,
        questions: {
          create: [
            {
              id: "question-text",
              type: "text",
              text: "自由記述",
              required: false,
              sortOrder: 2,
            },
            {
              id: "question-choice",
              type: "single_choice",
              text: "選択式",
              required: true,
              sortOrder: 1,
              choices: {
                create: [
                  {
                    id: "choice-no",
                    value: "no",
                    label: "いいえ",
                    sortOrder: 2,
                  },
                  {
                    id: "choice-yes",
                    value: "yes",
                    label: "はい",
                    sortOrder: 1,
                  },
                ],
              },
            },
          ],
        },
      },
    })
  }

  async function seedUser(id: string): Promise<void> {
    await prisma.user.create({
      data: {
        id,
        email: `${id}@example.com`,
        name: `User ${id}`,
        displayName: `表示名 ${id}`,
      },
    })
  }

  describe("findActiveSurveyView", () => {
    it("公開中アンケートを設問・選択肢が sortOrder 順の DTO で返す", async () => {
      await seedSurvey()

      const result = await queryService.findActiveSurveyView()

      expect(result).toEqual({
        id: "survey-1",
        slug: "pmf-2026",
        title: "PMFアンケート",
        questions: [
          {
            id: "question-choice",
            type: "single_choice",
            text: "選択式",
            required: true,
            sortOrder: 1,
            choices: [
              { value: "yes", label: "はい", sortOrder: 1 },
              { value: "no", label: "いいえ", sortOrder: 2 },
            ],
          },
          {
            id: "question-text",
            type: "text",
            text: "自由記述",
            required: false,
            sortOrder: 2,
            choices: [],
          },
        ],
      })
    })

    it("公開中アンケートが存在しない場合は null を返す", async () => {
      await expect(queryService.findActiveSurveyView()).resolves.toBeNull()
    })
  })

  describe("listSubmissions", () => {
    it("提出を新しい順で user と回答を含む DTO にして返す", async () => {
      await seedSurvey()
      await seedUser("user-1")
      const createdAt = new Date("2026-07-26T02:00:00.000Z")
      await prisma.feedbackSubmission.create({
        data: {
          id: "submission-1",
          surveyId: "survey-1",
          userId: "user-1",
          createdAt,
          answers: {
            create: [
              {
                id: "answer-text",
                questionId: "question-text",
                textValue: "回答本文",
              },
              {
                id: "answer-choice",
                questionId: "question-choice",
                choiceId: "choice-yes",
              },
            ],
          },
        },
      })

      const result = await queryService.listSubmissions({
        limit: 20,
        offset: 0,
      })

      expect(result).toEqual({
        total: 1,
        items: [
          {
            id: "submission-1",
            surveyId: "survey-1",
            user: {
              id: "user-1",
              email: "user-1@example.com",
              name: "User user-1",
              displayName: "表示名 user-1",
            },
            createdAt,
            answers: [
              {
                questionId: "question-choice",
                questionText: "選択式",
                choiceValue: "yes",
                choiceLabel: "はい",
                textValue: null,
              },
              {
                questionId: "question-text",
                questionText: "自由記述",
                choiceValue: null,
                choiceLabel: null,
                textValue: "回答本文",
              },
            ],
          },
        ],
      })
    })

    it("limit / offset を適用し、total は全提出件数を返す", async () => {
      await seedSurvey()
      await seedUser("user-1")
      const sameTime = new Date("2026-07-26T02:00:00.000Z")
      await prisma.feedbackSubmission.createMany({
        data: [
          {
            id: "submission-a",
            surveyId: "survey-1",
            userId: "user-1",
            createdAt: sameTime,
          },
          {
            id: "submission-c",
            surveyId: "survey-1",
            userId: "user-1",
            createdAt: sameTime,
          },
          {
            id: "submission-b",
            surveyId: "survey-1",
            userId: "user-1",
            createdAt: sameTime,
          },
        ],
      })

      const result = await queryService.listSubmissions({ limit: 1, offset: 1 })

      expect(result.total).toBe(3)
      expect(result.items.map((item) => item.id)).toEqual(["submission-b"])
    })

    it("提出が存在しない場合は空配列と total 0 を返す", async () => {
      await expect(
        queryService.listSubmissions({ limit: 20, offset: 0 })
      ).resolves.toEqual({
        items: [],
        total: 0,
      })
    })
  })

  describe("summarize", () => {
    it("同一ユーザーは最新提出のみ採用し、母数と選択肢件数を返す", async () => {
      await seedSurvey()
      await seedUser("user-1")
      await seedUser("user-2")
      await prisma.feedbackSubmission.create({
        data: {
          id: "user-1-old",
          surveyId: "survey-1",
          userId: "user-1",
          createdAt: new Date("2026-07-26T01:00:00.000Z"),
          answers: {
            create: {
              id: "answer-user-1-old",
              questionId: "question-choice",
              choiceId: "choice-yes",
            },
          },
        },
      })
      await prisma.feedbackSubmission.create({
        data: {
          id: "user-1-new",
          surveyId: "survey-1",
          userId: "user-1",
          createdAt: new Date("2026-07-26T02:00:00.000Z"),
          answers: {
            create: {
              id: "answer-user-1-new",
              questionId: "question-choice",
              choiceId: "choice-no",
            },
          },
        },
      })
      await prisma.feedbackSubmission.create({
        data: {
          id: "user-2-only",
          surveyId: "survey-1",
          userId: "user-2",
          createdAt: new Date("2026-07-26T01:30:00.000Z"),
          answers: {
            create: {
              id: "answer-user-2",
              questionId: "question-choice",
              choiceId: "choice-yes",
            },
          },
        },
      })

      const result = await queryService.summarize("survey-1")

      expect(result).toEqual({
        respondentCount: 2,
        tallies: [
          { questionId: "question-choice", choiceValue: "no", count: 1 },
          { questionId: "question-choice", choiceValue: "yes", count: 1 },
        ],
      })
    })

    it("createdAt が同じ場合は id が大きい提出を最新として採用する", async () => {
      await seedSurvey()
      await seedUser("user-1")
      const sameTime = new Date("2026-07-26T02:00:00.000Z")
      await prisma.feedbackSubmission.create({
        data: {
          id: "submission-a",
          surveyId: "survey-1",
          userId: "user-1",
          createdAt: sameTime,
          answers: {
            create: {
              id: "answer-a",
              questionId: "question-choice",
              choiceId: "choice-yes",
            },
          },
        },
      })
      await prisma.feedbackSubmission.create({
        data: {
          id: "submission-b",
          surveyId: "survey-1",
          userId: "user-1",
          createdAt: sameTime,
          answers: {
            create: {
              id: "answer-b",
              questionId: "question-choice",
              choiceId: "choice-no",
            },
          },
        },
      })

      await expect(queryService.summarize("survey-1")).resolves.toEqual({
        respondentCount: 1,
        tallies: [
          { questionId: "question-choice", choiceValue: "no", count: 1 },
        ],
      })
    })

    it("提出が存在しない場合は母数0と空の tally を返す", async () => {
      await expect(queryService.summarize("missing-survey")).resolves.toEqual({
        respondentCount: 0,
        tallies: [],
      })
    })
  })
})
