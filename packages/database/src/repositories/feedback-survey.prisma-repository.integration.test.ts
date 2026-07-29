import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import {
  FeedbackSurveyDraft,
  FeedbackSurveyEntity,
  FeedbackSurveySlugConflictError,
  InvalidArgumentError,
} from "@workspace/domain"
import { FeedbackSurveyPrismaRepository } from "./feedback-survey.prisma-repository"
import { createTestPrismaClient, resetDatabase } from "../test-utils"

function surveyDraft(
  overrides: Partial<FeedbackSurveyDraft> = {}
): FeedbackSurveyDraft {
  return {
    id: "survey-1",
    slug: "pmf-2026",
    title: "PMFアンケート",
    isActive: true,
    questions: [
      {
        id: "question-1",
        type: "single_choice",
        text: "どう思いますか？",
        required: true,
        choices: [
          { id: "choice-1", value: "very_disappointed", label: "非常に残念" },
          { id: "choice-2", value: "not_disappointed", label: "特に何も" },
        ],
      },
      {
        id: "question-2",
        type: "text",
        text: "一番の価値は？",
        required: false,
        choices: [],
      },
    ],
    ...overrides,
  }
}

describe("FeedbackSurveyPrismaRepository (integration)", () => {
  let prisma: PrismaClient
  let repository: FeedbackSurveyPrismaRepository

  beforeAll(() => {
    prisma = createTestPrismaClient()
    repository = new FeedbackSurveyPrismaRepository(prisma)
  })

  beforeEach(async () => {
    await resetDatabase(prisma)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it("公開中アンケートを設問・選択肢の sortOrder 順で復元する", async () => {
    await prisma.feedbackSurvey.create({
      data: {
        id: "inactive-survey",
        slug: "inactive",
        title: "非公開",
        isActive: false,
      },
    })
    await prisma.feedbackSurvey.create({
      data: {
        id: "active-survey",
        slug: "active",
        title: "公開中",
        isActive: true,
        questions: {
          create: [
            {
              id: "question-2",
              type: "text",
              text: "自由記述",
              required: false,
              sortOrder: 2,
            },
            {
              id: "question-1",
              type: "single_choice",
              text: "選択式",
              required: true,
              sortOrder: 1,
              choices: {
                create: [
                  {
                    id: "choice-2",
                    value: "no",
                    label: "いいえ",
                    sortOrder: 2,
                  },
                  { id: "choice-1", value: "yes", label: "はい", sortOrder: 1 },
                ],
              },
            },
          ],
        },
      },
    })

    const survey = await repository.findActive()

    expect(survey?.id).toBe("active-survey")
    expect(survey?.slug).toBe("active")
    expect(survey?.title).toBe("公開中")
    expect(survey?.isActive).toBe(true)
    expect(survey?.questions.map((question) => question.id)).toEqual([
      "question-1",
      "question-2",
    ])
    expect(survey?.questions[0]?.type).toBe("single_choice")
    expect(survey?.questions[0]?.required).toBe(true)
    expect(survey?.questions[0]?.choices.map((choice) => choice.id)).toEqual([
      "choice-1",
      "choice-2",
    ])
  })

  it("公開中アンケートが存在しない場合は null を返す", async () => {
    await prisma.feedbackSurvey.create({
      data: {
        id: "inactive-survey",
        slug: "inactive",
        title: "非公開",
        isActive: false,
      },
    })

    await expect(repository.findActive()).resolves.toBeNull()
  })

  it("不正なアンケートを復元できない場合は cause 付きの文脈エラーを返す", async () => {
    await prisma.feedbackSurvey.create({
      data: {
        id: "invalid-survey",
        slug: "invalid",
        title: "",
        isActive: true,
      },
    })

    await expect(repository.findActive()).rejects.toMatchObject({
      message:
        "Failed to reconstitute FeedbackSurveyEntity (id=invalid-survey)",
      cause: expect.any(InvalidArgumentError),
    })
  })

  it("save で作成したアンケートを findById で復元でき、設問・選択肢の順序も一致する", async () => {
    const entity = FeedbackSurveyEntity.create(surveyDraft())

    const saved = await repository.save(entity)
    const found = await repository.findById("survey-1")

    for (const survey of [saved, found]) {
      expect(survey?.slug).toBe("pmf-2026")
      expect(survey?.title).toBe("PMFアンケート")
      expect(survey?.isActive).toBe(true)
      expect(survey?.questions.map((question) => question.id)).toEqual([
        "question-1",
        "question-2",
      ])
      expect(survey?.questions.map((question) => question.sortOrder)).toEqual([
        0, 1,
      ])
      expect(survey?.questions[0]?.type).toBe("single_choice")
      expect(survey?.questions[0]?.required).toBe(true)
      expect(survey?.questions[0]?.choices.map((choice) => choice.id)).toEqual([
        "choice-1",
        "choice-2",
      ])
      expect(
        survey?.questions[0]?.choices.map((choice) => choice.sortOrder)
      ).toEqual([0, 1])
      expect(survey?.questions[1]?.choices).toEqual([])
    }
  })

  it("存在しない id の findById は null を返す", async () => {
    await expect(repository.findById("missing")).resolves.toBeNull()
  })

  it("findBySlug で slug からアンケートを引ける", async () => {
    await repository.save(FeedbackSurveyEntity.create(surveyDraft()))

    const found = await repository.findBySlug("pmf-2026")

    expect(found?.id).toBe("survey-1")
    await expect(repository.findBySlug("missing")).resolves.toBeNull()
  })

  it("別 id で同一 slug を save すると FeedbackSurveySlugConflictError になる", async () => {
    await repository.save(FeedbackSurveyEntity.create(surveyDraft()))

    const duplicate = FeedbackSurveyEntity.create(
      surveyDraft({
        id: "survey-2",
        isActive: false,
        questions: [
          {
            id: "question-3",
            type: "text",
            text: "別アンケートの設問",
            required: false,
            choices: [],
          },
        ],
      })
    )

    await expect(repository.save(duplicate)).rejects.toBeInstanceOf(
      FeedbackSurveySlugConflictError
    )
    // 制約違反時に 2 件目が部分的に書き込まれないことを確認する。
    await expect(repository.findById("survey-2")).resolves.toBeNull()
  })

  it("既存アンケートへの save はスカラーだけを更新し、設問・選択肢を変更しない", async () => {
    await repository.save(FeedbackSurveyEntity.create(surveyDraft()))

    // save の update 分岐が設問に触らないことを固定する。Restrict FK を完全に回避するための
    // 意図的な非対称性であり、偶然そうなっている状態にしない。
    const withDifferentQuestions = FeedbackSurveyEntity.create(
      surveyDraft({
        slug: "pmf-2026-renamed",
        title: "改名後",
        isActive: false,
        questions: [
          {
            id: "question-9",
            type: "text",
            text: "差し替えたはずの設問",
            required: true,
            choices: [],
          },
        ],
      })
    )

    await repository.save(withDifferentQuestions)
    const found = await repository.findById("survey-1")

    expect(found?.slug).toBe("pmf-2026-renamed")
    expect(found?.title).toBe("改名後")
    expect(found?.isActive).toBe(false)
    expect(found?.questions.map((question) => question.id)).toEqual([
      "question-1",
      "question-2",
    ])
    expect(found?.questions[0]?.choices.map((choice) => choice.id)).toEqual([
      "choice-1",
      "choice-2",
    ])
  })

  it("activateExclusively は対象を有効化し、他をすべて無効化する", async () => {
    await repository.save(FeedbackSurveyEntity.create(surveyDraft()))
    await repository.save(
      FeedbackSurveyEntity.create(
        surveyDraft({
          id: "survey-2",
          slug: "second",
          isActive: false,
          questions: [
            {
              id: "question-3",
              type: "text",
              text: "2 つめの設問",
              required: false,
              choices: [],
            },
          ],
        })
      )
    )

    await repository.activateExclusively("survey-2")

    const active = await prisma.feedbackSurvey.findMany({
      where: { isActive: true },
      select: { id: true },
    })
    expect(active).toEqual([{ id: "survey-2" }])
    expect((await repository.findActive())?.id).toBe("survey-2")
  })

  it("activateExclusively を同じアンケートに繰り返しても有効なのは 1 件のまま", async () => {
    await repository.save(FeedbackSurveyEntity.create(surveyDraft()))

    await repository.activateExclusively("survey-1")
    await repository.activateExclusively("survey-1")

    await expect(
      prisma.feedbackSurvey.count({ where: { isActive: true } })
    ).resolves.toBe(1)
  })

  it("回答のないアンケートの delete は設問・選択肢ごと削除する", async () => {
    const entity = FeedbackSurveyEntity.create(surveyDraft())
    await repository.save(entity)

    await repository.delete(entity)

    await expect(repository.findById("survey-1")).resolves.toBeNull()
    await expect(prisma.feedbackQuestion.count()).resolves.toBe(0)
    await expect(prisma.feedbackChoice.count()).resolves.toBe(0)
  })

  // ここから 2 件は PR11（設問編集・削除の follow-up）の設計材料として、
  // 回答が存在する状態での削除の「実測挙動」を固定するためのテスト。
  // FeedbackAnswer.choiceId は onDelete: Restrict、FeedbackChoice.question と
  // FeedbackAnswer.submission は onDelete: Cascade であり、結果は自明ではない。
  describe("回答が存在する状態での削除の実測挙動 (PR11 の設計材料)", () => {
    beforeEach(async () => {
      await repository.save(FeedbackSurveyEntity.create(surveyDraft()))
      await prisma.user.create({
        data: {
          id: "user-1",
          email: "respondent@example.com",
          name: "Respondent",
        },
      })
      await prisma.feedbackSubmission.create({
        data: {
          id: "submission-1",
          surveyId: "survey-1",
          userId: "user-1",
          answers: {
            create: [
              { questionId: "question-1", choiceId: "choice-1" },
              { questionId: "question-2", textValue: "とても良い" },
            ],
          },
        },
      })
    })

    // 実測: アンケートの delete は Restrict に阻まれず**成功する**。
    // FeedbackSubmission への Cascade が FeedbackAnswer を先に削除するため、
    // FeedbackChoice の削除時点で choiceId を参照する行が残っていない。
    // つまり DELETE /admin/feedback/surveys/{id} は回答者データを黙って全消しする。
    // これが PR11 で DELETE をスコープ外にしている根拠であり、実装するなら
    // 提出 0 件ガードが必須になる。
    it("回答つきアンケートの delete は成功し、提出・回答も連鎖削除される", async () => {
      const entity = FeedbackSurveyEntity.create(surveyDraft())

      await repository.delete(entity)

      await expect(repository.findById("survey-1")).resolves.toBeNull()
      await expect(prisma.feedbackSubmission.count()).resolves.toBe(0)
      await expect(prisma.feedbackAnswer.count()).resolves.toBe(0)
      await expect(prisma.feedbackQuestion.count()).resolves.toBe(0)
      await expect(prisma.feedbackChoice.count()).resolves.toBe(0)
      // 回答者そのものは残る（FeedbackSubmission.user は User 側からの Cascade）。
      await expect(prisma.user.count()).resolves.toBe(1)
    })

    // 実測: 回答済み設問の削除も成功する。FeedbackAnswer.question の Cascade が
    // 回答を先に消すため、choiceId の Restrict がここでも発火しない。
    // ただし「設問を消すと、その設問への過去の回答が消える」ため、
    // 設問の delete-and-recreate は集計データを黙って破壊する。
    it("回答済み設問の削除は成功するが、その設問への回答も連鎖削除される", async () => {
      await prisma.feedbackQuestion.delete({ where: { id: "question-1" } })

      await expect(
        prisma.feedbackQuestion.count({ where: { id: "question-1" } })
      ).resolves.toBe(0)
      await expect(prisma.feedbackChoice.count()).resolves.toBe(0)
      // question-2 への自由記述回答だけが残る。
      await expect(prisma.feedbackAnswer.count()).resolves.toBe(1)
      // 提出行そのものは残るため、回答 0 件の提出が生まれる。
      await expect(prisma.feedbackSubmission.count()).resolves.toBe(1)
    })

    // 実測: Restrict が実際に発火するのは「選択肢だけを直接消す」経路。
    // FeedbackChoice から FeedbackAnswer への Cascade は無いため参照が残る。
    // 「設問は保ったまま選択肢を差し替える」編集はこれに当たり、PR11 の中心的な課題。
    it("回答済み選択肢の単体削除は Restrict FK に阻まれて失敗する", async () => {
      await expect(
        prisma.feedbackChoice.delete({ where: { id: "choice-1" } })
      ).rejects.toMatchObject({ code: "P2003" })

      // 失敗した削除はロールバックされ、選択肢と回答は残る。
      await expect(
        prisma.feedbackChoice.count({ where: { id: "choice-1" } })
      ).resolves.toBe(1)
      await expect(prisma.feedbackAnswer.count()).resolves.toBe(2)
    })
  })
})
