import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import {
  EmptyActiveFeedbackSurveyError,
  FeedbackSurveyDraft,
  FeedbackSurveyEntity,
  FeedbackSurveyHasSubmissionsError,
  FeedbackSurveyMustBeInactiveError,
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

  it("insert で作成したアンケートを findById で復元でき、設問・選択肢の順序も一致する", async () => {
    const entity = FeedbackSurveyEntity.create(surveyDraft())

    const saved = await repository.insert(entity)
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
    await repository.insert(FeedbackSurveyEntity.create(surveyDraft()))

    const found = await repository.findBySlug("pmf-2026")

    expect(found?.id).toBe("survey-1")
    await expect(repository.findBySlug("missing")).resolves.toBeNull()
  })

  it("別 id で同一 slug を insert すると FeedbackSurveySlugConflictError になる", async () => {
    await repository.insert(FeedbackSurveyEntity.create(surveyDraft()))

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

    await expect(repository.insert(duplicate)).rejects.toBeInstanceOf(
      FeedbackSurveySlugConflictError
    )
    // 制約違反時に 2 件目が部分的に書き込まれないことを確認する。
    await expect(repository.findById("survey-2")).resolves.toBeNull()
  })

  // create 分岐は設問・選択肢をネスト作成するため、それらの一意制約違反も同じ P2002 で届く。
  // ネストした設問の主キー衝突は meta.modelName が外側の "FeedbackSurvey" になるため、
  // slug 衝突と取り違えやすい。真因を隠さないことを固定する。
  it("ネストした設問の主キー衝突を slug 衝突へ誤変換しない", async () => {
    await repository.insert(FeedbackSurveyEntity.create(surveyDraft()))

    const collidingQuestionId = FeedbackSurveyEntity.create(
      surveyDraft({
        id: "survey-2",
        slug: "second",
        isActive: false,
        questions: [
          {
            id: "question-1",
            type: "text",
            text: "既存の設問 id と衝突する設問",
            required: false,
            choices: [],
          },
        ],
      })
    )

    const error = await repository.insert(collidingQuestionId).catch((e) => e)

    expect(error).not.toBeInstanceOf(FeedbackSurveySlugConflictError)
    expect(error).toMatchObject({ code: "P2002" })
  })

  it("既存アンケートへの update はスカラーだけを更新し、設問・選択肢を変更しない", async () => {
    await repository.insert(FeedbackSurveyEntity.create(surveyDraft()))

    // update が設問に触らないことを固定する。Restrict FK を完全に回避するための
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

    await repository.update(withDifferentQuestions)
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
    await repository.insert(FeedbackSurveyEntity.create(surveyDraft()))
    const second = FeedbackSurveyEntity.create(
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
    await repository.insert(second)

    await repository.activateExclusively(second)

    const active = await prisma.feedbackSurvey.findMany({
      where: { isActive: true },
      select: { id: true },
    })
    expect(active).toEqual([{ id: "survey-2" }])
    expect((await repository.findActive())?.id).toBe("survey-2")
  })

  it("activateExclusively を同じアンケートに繰り返しても有効なのは 1 件のまま", async () => {
    const entity = FeedbackSurveyEntity.create(surveyDraft())
    await repository.insert(entity)

    await repository.activateExclusively(entity)
    await repository.activateExclusively(entity)

    await expect(
      prisma.feedbackSurvey.count({ where: { isActive: true } })
    ).resolves.toBe(1)
  })

  // Entity の不変条件を迂回した有効化を防ぐ。これを許すと findActive() の
  // reconstitute が常に失敗し、回答者向けフォームが壊れる。
  it("設問 0 件のアンケートの activateExclusively は拒否し、他の有効化状態も変えない", async () => {
    const active = FeedbackSurveyEntity.create(surveyDraft())
    await repository.insert(active)
    const empty = FeedbackSurveyEntity.create(
      surveyDraft({
        id: "survey-empty",
        slug: "empty",
        isActive: false,
        questions: [],
      })
    )
    await repository.insert(empty)

    await expect(repository.activateExclusively(empty)).rejects.toBeInstanceOf(
      EmptyActiveFeedbackSurveyError
    )

    // 「他を無効化したのに対象を有効化できない」中間状態を残さずロールバックされる。
    const stillActive = await prisma.feedbackSurvey.findMany({
      where: { isActive: true },
      select: { id: true },
    })
    expect(stillActive).toEqual([{ id: "survey-1" }])
  })

  it("永続化状態から設問が消えている場合の activateExclusively も拒否する", async () => {
    // Entity は読み込み時点のスナップショットなので、設問件数は DB 側でも検証する。
    const entity = FeedbackSurveyEntity.create(surveyDraft())
    await repository.insert(entity)
    await prisma.feedbackQuestion.deleteMany({
      where: { surveyId: "survey-1" },
    })

    await expect(repository.activateExclusively(entity)).rejects.toBeInstanceOf(
      EmptyActiveFeedbackSurveyError
    )
  })

  it("回答のないアンケートの delete は設問・選択肢ごと削除する", async () => {
    const entity = FeedbackSurveyEntity.create(surveyDraft({ isActive: false }))
    await repository.insert(entity)

    await repository.delete(entity)

    await expect(repository.findById("survey-1")).resolves.toBeNull()
    await expect(prisma.feedbackQuestion.count()).resolves.toBe(0)
    await expect(prisma.feedbackChoice.count()).resolves.toBe(0)
  })

  it("公開中アンケートの delete を拒否する", async () => {
    const entity = FeedbackSurveyEntity.create(surveyDraft())
    await repository.insert(entity)

    await expect(repository.delete(entity)).rejects.toBeInstanceOf(
      FeedbackSurveyMustBeInactiveError
    )
    await expect(repository.findById("survey-1")).resolves.not.toBeNull()
  })

  it("delete と古いスナップショットからの update が競合しても削除済みアンケートを復活させない", async () => {
    const original = FeedbackSurveyEntity.create(
      surveyDraft({ isActive: false })
    )
    await repository.insert(original)
    const staleUpdate = original.changeTitle("古いスナップショットからの更新")

    const [deleteResult, updateResult] = await Promise.allSettled([
      repository.delete(original),
      repository.update(staleUpdate),
    ])

    expect(deleteResult.status).toBe("fulfilled")
    expect(updateResult.status).toBe("fulfilled")
    await expect(repository.findById("survey-1")).resolves.toBeNull()
  })

  it("未公開・提出 0 件なら設問セットを全置換し、sortOrder を配列順で保存する", async () => {
    const original = FeedbackSurveyEntity.create(
      surveyDraft({ isActive: false })
    )
    await repository.insert(original)
    const replacement = original.replaceQuestions([
      {
        id: "replacement-question-1",
        type: "text",
        text: "新しい自由記述",
        required: false,
        choices: [],
      },
      {
        id: "replacement-question-2",
        type: "single_choice",
        text: "新しい選択式",
        required: true,
        choices: [
          { id: "replacement-choice-1", value: "yes", label: "はい" },
          { id: "replacement-choice-2", value: "no", label: "いいえ" },
        ],
      },
    ])

    const saved = await repository.replaceQuestions(replacement)

    expect(
      saved?.questions.map(({ id, sortOrder }) => ({ id, sortOrder }))
    ).toEqual([
      { id: "replacement-question-1", sortOrder: 0 },
      { id: "replacement-question-2", sortOrder: 1 },
    ])
    expect(
      saved?.questions[1]?.choices.map(({ id, sortOrder }) => ({
        id,
        sortOrder,
      }))
    ).toEqual([
      { id: "replacement-choice-1", sortOrder: 0 },
      { id: "replacement-choice-2", sortOrder: 1 },
    ])
    await expect(
      prisma.feedbackQuestion.count({ where: { id: "question-1" } })
    ).resolves.toBe(0)
  })

  it("公開中アンケートの設問置換を拒否し、既存設問を保つ", async () => {
    const original = FeedbackSurveyEntity.create(surveyDraft())
    await repository.insert(original)
    const replacement = FeedbackSurveyEntity.create(
      surveyDraft({
        isActive: false,
        questions: [
          {
            id: "replacement-question",
            type: "text",
            text: "置換",
            required: false,
            choices: [],
          },
        ],
      })
    )

    await expect(
      repository.replaceQuestions(replacement)
    ).rejects.toBeInstanceOf(FeedbackSurveyMustBeInactiveError)
    await expect(
      prisma.feedbackQuestion.count({ where: { id: "question-1" } })
    ).resolves.toBe(1)
  })

  it("設問置換と旧設問への投稿が競合しても、片方だけを確定して回答を破壊しない", async () => {
    const original = FeedbackSurveyEntity.create(
      surveyDraft({ isActive: false })
    )
    await repository.insert(original)
    await prisma.user.create({
      data: {
        id: "user-1",
        email: "respondent@example.com",
        name: "Respondent",
      },
    })
    const replacement = original.replaceQuestions([
      {
        id: "replacement-question",
        type: "text",
        text: "新しい設問",
        required: false,
        choices: [],
      },
    ])

    const [replaceResult, submitResult] = await Promise.allSettled([
      repository.replaceQuestions(replacement),
      prisma.feedbackSubmission.create({
        data: {
          id: "submission-1",
          surveyId: "survey-1",
          userId: "user-1",
          answers: {
            create: [{ questionId: "question-1", choiceId: "choice-1" }],
          },
        },
      }),
    ])

    expect(
      [replaceResult, submitResult].filter(
        ({ status }) => status === "fulfilled"
      )
    ).toHaveLength(1)
    if (submitResult.status === "fulfilled") {
      expect(replaceResult.status).toBe("rejected")
      if (replaceResult.status === "rejected") {
        expect(replaceResult.reason).toBeInstanceOf(
          FeedbackSurveyHasSubmissionsError
        )
      }
      await expect(prisma.feedbackSubmission.count()).resolves.toBe(1)
      await expect(prisma.feedbackAnswer.count()).resolves.toBe(1)
      await expect(
        prisma.feedbackQuestion.count({ where: { id: "question-1" } })
      ).resolves.toBe(1)
    } else {
      expect(replaceResult.status).toBe("fulfilled")
      await expect(prisma.feedbackSubmission.count()).resolves.toBe(0)
      await expect(prisma.feedbackAnswer.count()).resolves.toBe(0)
      await expect(
        prisma.feedbackQuestion.count({
          where: { id: "replacement-question" },
        })
      ).resolves.toBe(1)
    }
  })

  it("空設問への置換と古いスナップショットからの有効化が競合しても不正なactiveを作らない", async () => {
    const original = FeedbackSurveyEntity.create(
      surveyDraft({ isActive: false })
    )
    await repository.insert(original)
    const staleActivation = original.activate()
    const emptyReplacement = original.replaceQuestions([])

    const results = await Promise.allSettled([
      repository.replaceQuestions(emptyReplacement),
      repository.update(staleActivation),
    ])

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1
    )
    const persisted = await prisma.feedbackSurvey.findUniqueOrThrow({
      where: { id: "survey-1" },
      select: {
        isActive: true,
        _count: { select: { questions: true } },
      },
    })
    expect(persisted.isActive && persisted._count.questions === 0).toBe(false)
    if (persisted.isActive) {
      expect(results[0]?.status).toBe("rejected")
      if (results[0]?.status === "rejected") {
        expect(results[0].reason).toBeInstanceOf(
          FeedbackSurveyMustBeInactiveError
        )
      }
    } else {
      expect(results[1]?.status).toBe("rejected")
      if (results[1]?.status === "rejected") {
        expect(results[1].reason).toBeInstanceOf(EmptyActiveFeedbackSurveyError)
      }
    }
  })

  it("空設問への置換と activateExclusively が競合しても不正なactiveを作らない", async () => {
    const original = FeedbackSurveyEntity.create(
      surveyDraft({ isActive: false })
    )
    await repository.insert(original)
    const activation = original.activate()
    const emptyReplacement = original.replaceQuestions([])

    const results = await Promise.allSettled([
      repository.replaceQuestions(emptyReplacement),
      repository.activateExclusively(activation),
    ])

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1
    )
    const persisted = await prisma.feedbackSurvey.findUniqueOrThrow({
      where: { id: "survey-1" },
      select: {
        isActive: true,
        _count: { select: { questions: true } },
      },
    })
    expect(persisted.isActive && persisted._count.questions === 0).toBe(false)
    if (persisted.isActive) {
      expect(results[0]?.status).toBe("rejected")
      if (results[0]?.status === "rejected") {
        expect(results[0].reason).toBeInstanceOf(
          FeedbackSurveyMustBeInactiveError
        )
      }
    } else {
      expect(results[1]?.status).toBe("rejected")
      if (results[1]?.status === "rejected") {
        expect(results[1].reason).toBeInstanceOf(EmptyActiveFeedbackSurveyError)
      }
    }
  })

  // DB の Cascade / Restrict の実測は残しつつ、Repository の公開契約では
  // 回答データを破壊する survey delete / question-set replace を拒否する。
  // FeedbackAnswer.choiceId は onDelete: Restrict、FeedbackChoice.question と
  // FeedbackAnswer.submission は onDelete: Cascade であり、結果は自明ではない。
  describe("回答が存在する状態での保護契約とDB削除挙動", () => {
    beforeEach(async () => {
      await repository.insert(
        FeedbackSurveyEntity.create(surveyDraft({ isActive: false }))
      )
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

    it("回答つきアンケートのRepository deleteを拒否し、全データを保つ", async () => {
      const entity = FeedbackSurveyEntity.create(
        surveyDraft({ isActive: false })
      )

      await expect(repository.delete(entity)).rejects.toBeInstanceOf(
        FeedbackSurveyHasSubmissionsError
      )

      await expect(repository.findById("survey-1")).resolves.not.toBeNull()
      await expect(prisma.feedbackSubmission.count()).resolves.toBe(1)
      await expect(prisma.feedbackAnswer.count()).resolves.toBe(2)
      await expect(prisma.feedbackQuestion.count()).resolves.toBe(2)
      await expect(prisma.feedbackChoice.count()).resolves.toBe(2)
    })

    it("回答つきアンケートの設問置換を拒否し、回答と設問を保つ", async () => {
      const replacement = FeedbackSurveyEntity.create(
        surveyDraft({
          isActive: false,
          questions: [
            {
              id: "replacement-question",
              type: "text",
              text: "置換",
              required: false,
              choices: [],
            },
          ],
        })
      )

      await expect(
        repository.replaceQuestions(replacement)
      ).rejects.toBeInstanceOf(FeedbackSurveyHasSubmissionsError)
      await expect(prisma.feedbackSubmission.count()).resolves.toBe(1)
      await expect(prisma.feedbackAnswer.count()).resolves.toBe(2)
      await expect(prisma.feedbackQuestion.count()).resolves.toBe(2)
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
      // question-2 への自由記述回答 1 件だけが残る。
      await expect(prisma.feedbackAnswer.count()).resolves.toBe(1)
      // 提出行そのものも残る。全設問を消す経路なら回答 0 件にもなり得る。
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
