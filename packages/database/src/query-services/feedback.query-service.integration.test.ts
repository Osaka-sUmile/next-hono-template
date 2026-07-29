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

  /**
   * 別バージョンのアンケート。surveyId による絞り込みが効いていることを
   * 検証するために、DB 上にアンケートが複数存在する状態を作る。
   */
  async function seedOtherSurvey(): Promise<void> {
    await prisma.feedbackSurvey.create({
      data: {
        id: "survey-2",
        slug: "pmf-2027",
        title: "旧PMFアンケート",
        isActive: false,
        questions: {
          create: [
            {
              id: "question-choice-2",
              type: "single_choice",
              text: "選択式(旧)",
              required: true,
              sortOrder: 1,
              choices: {
                create: [
                  {
                    id: "choice-2-yes",
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

    // DB が空のときだけでなく、非公開アンケートが存在する状態でも null になることを
    // 確認する。これがないと where: { isActive: true } が外れても検知できない。
    it("非公開アンケートしか存在しない場合は null を返す", async () => {
      await seedOtherSurvey()

      await expect(queryService.findActiveSurveyView()).resolves.toBeNull()
    })
  })

  describe("listSurveys", () => {
    it("公開・非公開を問わず新しい順で設問数と提出数を返す", async () => {
      await prisma.feedbackSurvey.create({
        data: {
          id: "survey-old",
          slug: "old",
          title: "旧アンケート",
          isActive: false,
          createdAt: new Date("2026-07-01T00:00:00.000Z"),
        },
      })
      await prisma.feedbackSurvey.create({
        data: {
          id: "survey-new",
          slug: "new",
          title: "新アンケート",
          isActive: true,
          createdAt: new Date("2026-07-20T00:00:00.000Z"),
          questions: {
            create: [
              {
                id: "q-1",
                type: "text",
                text: "設問1",
                required: false,
                sortOrder: 1,
              },
              {
                id: "q-2",
                type: "text",
                text: "設問2",
                required: false,
                sortOrder: 2,
              },
            ],
          },
        },
      })
      await seedUser("user-1")
      await prisma.feedbackSubmission.create({
        data: {
          id: "submission-1",
          surveyId: "survey-new",
          userId: "user-1",
          createdAt: new Date("2026-07-21T00:00:00.000Z"),
        },
      })

      const result = await queryService.listSurveys()

      expect(result).toEqual([
        {
          id: "survey-new",
          slug: "new",
          title: "新アンケート",
          isActive: true,
          questionCount: 2,
          submissionCount: 1,
          createdAt: new Date("2026-07-20T00:00:00.000Z"),
        },
        {
          id: "survey-old",
          slug: "old",
          title: "旧アンケート",
          isActive: false,
          questionCount: 0,
          submissionCount: 0,
          createdAt: new Date("2026-07-01T00:00:00.000Z"),
        },
      ])
    })

    it("createdAt が同じ場合は id の降順で並べる", async () => {
      const sameTime = new Date("2026-07-20T00:00:00.000Z")
      await prisma.feedbackSurvey.createMany({
        data: [
          { id: "survey-a", slug: "a", title: "A", createdAt: sameTime },
          { id: "survey-c", slug: "c", title: "C", createdAt: sameTime },
          { id: "survey-b", slug: "b", title: "B", createdAt: sameTime },
        ],
      })

      const result = await queryService.listSurveys()

      expect(result.map((survey) => survey.id)).toEqual([
        "survey-c",
        "survey-b",
        "survey-a",
      ])
    })

    it("アンケートが存在しない場合は空配列を返す", async () => {
      await expect(queryService.listSurveys()).resolves.toEqual([])
    })
  })

  describe("findSurveyDetailById", () => {
    it("設問・選択肢を sortOrder 順に並べ、公開状態込みで返す", async () => {
      await seedSurvey()

      const result = await queryService.findSurveyDetailById("survey-1")

      expect(result).toEqual({
        id: "survey-1",
        slug: "pmf-2026",
        title: "PMFアンケート",
        isActive: true,
        createdAt: expect.any(Date),
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

    // 一覧は非公開も含むので、詳細も isActive で絞らないことを固定する。
    it("非公開アンケートも取得できる", async () => {
      await seedOtherSurvey()

      const result = await queryService.findSurveyDetailById("survey-2")

      expect(result).toMatchObject({ id: "survey-2", isActive: false })
    })

    it("該当 id のアンケートが存在しない場合は null を返す", async () => {
      await seedSurvey()

      await expect(
        queryService.findSurveyDetailById("missing-survey")
      ).resolves.toBeNull()
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

      const result = await queryService.listSubmissions({
        limit: 1,
        offset: 1,
      })

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

    it("surveyId 指定時は該当アンケートの提出のみを返し、total も同条件で数える", async () => {
      await seedSurvey()
      await seedOtherSurvey()
      await seedUser("user-1")
      await prisma.feedbackSubmission.createMany({
        data: [
          {
            id: "submission-survey-1",
            surveyId: "survey-1",
            userId: "user-1",
            createdAt: new Date("2026-07-26T02:00:00.000Z"),
          },
          {
            id: "submission-survey-2",
            surveyId: "survey-2",
            userId: "user-1",
            createdAt: new Date("2026-07-26T03:00:00.000Z"),
          },
        ],
      })

      const result = await queryService.listSubmissions({
        limit: 20,
        offset: 0,
        surveyId: "survey-1",
      })

      expect(result.total).toBe(1)
      expect(result.items.map((item) => item.id)).toEqual([
        "submission-survey-1",
      ])
    })

    it("surveyId 未指定時は全アンケートの提出を横断して返す", async () => {
      await seedSurvey()
      await seedOtherSurvey()
      await seedUser("user-1")
      await prisma.feedbackSubmission.createMany({
        data: [
          {
            id: "submission-survey-1",
            surveyId: "survey-1",
            userId: "user-1",
            createdAt: new Date("2026-07-26T02:00:00.000Z"),
          },
          {
            id: "submission-survey-2",
            surveyId: "survey-2",
            userId: "user-1",
            createdAt: new Date("2026-07-26T03:00:00.000Z"),
          },
        ],
      })

      const result = await queryService.listSubmissions({
        limit: 20,
        offset: 0,
      })

      expect(result.total).toBe(2)
      expect(result.items.map((item) => item.id)).toEqual([
        "submission-survey-2",
        "submission-survey-1",
      ])
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

    it("回答が0件の提出も母数に数える", async () => {
      await seedSurvey()
      await seedUser("user-1")
      await prisma.feedbackSubmission.create({
        data: {
          id: "submission-without-answers",
          surveyId: "survey-1",
          userId: "user-1",
          createdAt: new Date("2026-07-26T02:00:00.000Z"),
        },
      })

      await expect(queryService.summarize("survey-1")).resolves.toEqual({
        respondentCount: 1,
        tallies: [],
      })
    })

    it("他アンケートの提出を母数・tally のどちらにも混ぜない", async () => {
      await seedSurvey()
      await seedOtherSurvey()
      await seedUser("user-1")
      await seedUser("user-2")
      await prisma.feedbackSubmission.create({
        data: {
          id: "submission-survey-1",
          surveyId: "survey-1",
          userId: "user-1",
          createdAt: new Date("2026-07-26T02:00:00.000Z"),
          answers: {
            create: {
              id: "answer-survey-1",
              questionId: "question-choice",
              choiceId: "choice-yes",
            },
          },
        },
      })
      await prisma.feedbackSubmission.create({
        data: {
          id: "submission-survey-2",
          surveyId: "survey-2",
          userId: "user-2",
          createdAt: new Date("2026-07-26T03:00:00.000Z"),
          answers: {
            create: {
              id: "answer-survey-2",
              questionId: "question-choice-2",
              choiceId: "choice-2-yes",
            },
          },
        },
      })

      await expect(queryService.summarize("survey-1")).resolves.toEqual({
        respondentCount: 1,
        tallies: [
          { questionId: "question-choice", choiceValue: "yes", count: 1 },
        ],
      })
    })

    // 自由記述だけの提出は choiceId が null なので tally には現れないが、
    // 回答者としては母数に数える必要がある。
    it("自由記述のみの提出は母数に数えるが tally には含めない", async () => {
      await seedSurvey()
      await seedUser("user-1")
      await prisma.feedbackSubmission.create({
        data: {
          id: "submission-text-only",
          surveyId: "survey-1",
          userId: "user-1",
          createdAt: new Date("2026-07-26T02:00:00.000Z"),
          answers: {
            create: {
              id: "answer-text-only",
              questionId: "question-text",
              textValue: "自由記述だけ",
            },
          },
        },
      })

      await expect(queryService.summarize("survey-1")).resolves.toEqual({
        respondentCount: 1,
        tallies: [],
      })
    })

    it("最新提出が自由記述のみなら過去提出の選択肢は集計から外れる", async () => {
      await seedSurvey()
      await seedUser("user-1")
      await prisma.feedbackSubmission.create({
        data: {
          id: "submission-old-choice",
          surveyId: "survey-1",
          userId: "user-1",
          createdAt: new Date("2026-07-26T01:00:00.000Z"),
          answers: {
            create: {
              id: "answer-old-choice",
              questionId: "question-choice",
              choiceId: "choice-yes",
            },
          },
        },
      })
      await prisma.feedbackSubmission.create({
        data: {
          id: "submission-new-text",
          surveyId: "survey-1",
          userId: "user-1",
          createdAt: new Date("2026-07-26T02:00:00.000Z"),
          answers: {
            create: {
              id: "answer-new-text",
              questionId: "question-text",
              textValue: "選択をやめた",
            },
          },
        },
      })

      await expect(queryService.summarize("survey-1")).resolves.toEqual({
        respondentCount: 1,
        tallies: [],
      })
    })
  })
})
