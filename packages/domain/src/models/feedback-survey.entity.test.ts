import { describe, expect, it } from "vitest"
import { InvalidArgumentError } from "../errors"
import {
  EmptyActiveFeedbackSurveyError,
  FeedbackChoice,
  FeedbackQuestionEntity,
  FeedbackSurveyDraft,
  FeedbackSurveyEntity,
  FeedbackSurveyMustBeInactiveError,
  FeedbackSurveySlugConflictError,
  InvalidFeedbackQuestionTypeError,
  parseFeedbackQuestionType,
} from "./feedback-survey.entity"

describe("parseFeedbackQuestionType", () => {
  it.each(["single_choice", "text"] as const)(
    "有効な種別 %s を返す",
    (type) => {
      expect(parseFeedbackQuestionType(type)).toBe(type)
    }
  )

  it("未知の種別は専用エラーと値を含むメッセージで拒否する", () => {
    expect(() => parseFeedbackQuestionType("multiple_choice")).toThrow(
      InvalidFeedbackQuestionTypeError
    )
    expect(() => parseFeedbackQuestionType("multiple_choice")).toThrow(
      'Invalid FeedbackQuestionType: "multiple_choice"'
    )
  })

  it("空文字を拒否する", () => {
    expect(() => parseFeedbackQuestionType("")).toThrow(
      InvalidFeedbackQuestionTypeError
    )
  })
})

describe("FeedbackSurveyEntity", () => {
  it("設問と選択肢を含むアンケートを復元する", () => {
    const choice = FeedbackChoice.reconstitute("choice-1", "yes", "はい", 1)
    const question = FeedbackQuestionEntity.reconstitute(
      "question-1",
      "single_choice",
      "質問ですか？",
      true,
      1,
      [choice]
    )

    const survey = FeedbackSurveyEntity.reconstitute(
      "survey-1",
      "survey-slug",
      "アンケート",
      true,
      [question]
    )

    expect(survey.id).toBe("survey-1")
    expect(survey.slug).toBe("survey-slug")
    expect(survey.title).toBe("アンケート")
    expect(survey.isActive).toBe(true)
    expect(survey.questions).toEqual([question])
    expect(survey.findQuestionById("question-1")).toBe(question)
    expect(survey.findQuestionById("missing")).toBeNull()
    expect(question.findChoiceByValue("yes")).toBe(choice)
    expect(question.findChoiceByValue("missing")).toBeNull()
  })

  it.each([
    {
      field: "value",
      act: () => FeedbackChoice.reconstitute("choice-1", "", "はい", 0),
      message: 'FeedbackChoice value must not be empty: id="choice-1"',
    },
    {
      field: "value",
      act: () => FeedbackChoice.reconstitute("choice-1", "  ", "はい", 0),
      message: 'FeedbackChoice value must not be empty: id="choice-1"',
    },
    {
      field: "label",
      act: () => FeedbackChoice.reconstitute("choice-1", "yes", "", 0),
      message: 'FeedbackChoice label must not be empty: id="choice-1"',
    },
    {
      field: "label",
      act: () => FeedbackChoice.reconstitute("choice-1", "yes", "  ", 0),
      message: 'FeedbackChoice label must not be empty: id="choice-1"',
    },
  ])("選択肢の空の $field を拒否する", ({ act, message }) => {
    expect(act).toThrow(InvalidArgumentError)
    expect(act).toThrow(message)
  })

  it("選択肢の負の sortOrder を拒否し、0 は許可する", () => {
    expect(() =>
      FeedbackChoice.reconstitute("choice-1", "yes", "はい", -1)
    ).toThrow(InvalidArgumentError)
    expect(() =>
      FeedbackChoice.reconstitute("choice-1", "yes", "はい", -1)
    ).toThrow('FeedbackChoice sortOrder must be non-negative: id="choice-1"')
    expect(
      FeedbackChoice.reconstitute("choice-1", "yes", "はい", 0).sortOrder
    ).toBe(0)
  })

  it.each(["", "  "])("設問の空の text を拒否する", (text) => {
    const act = () =>
      FeedbackQuestionEntity.reconstitute(
        "question-1",
        "text",
        text,
        false,
        0,
        []
      )

    expect(act).toThrow(InvalidArgumentError)
    expect(act).toThrow(
      'FeedbackQuestion text must not be empty: id="question-1"'
    )
  })

  it("設問の負の sortOrder を拒否し、0 は許可する", () => {
    const createQuestion = (sortOrder: number) =>
      FeedbackQuestionEntity.reconstitute(
        "question-1",
        "text",
        "自由記述",
        false,
        sortOrder,
        []
      )

    expect(() => createQuestion(-1)).toThrow(InvalidArgumentError)
    expect(() => createQuestion(-1)).toThrow(
      'FeedbackQuestion sortOrder must be non-negative: id="question-1"'
    )
    expect(createQuestion(0).sortOrder).toBe(0)
  })

  it("選択式設問に選択肢がない場合は拒否する", () => {
    const act = () =>
      FeedbackQuestionEntity.reconstitute(
        "question-1",
        "single_choice",
        "選択してください",
        true,
        0,
        []
      )

    expect(act).toThrow(InvalidArgumentError)
    expect(act).toThrow(
      'single_choice FeedbackQuestion must have at least one choice: id="question-1"'
    )
  })

  it("設問内で重複する選択肢 value を拒否する", () => {
    const choices = [
      FeedbackChoice.reconstitute("choice-1", "yes", "はい", 0),
      FeedbackChoice.reconstitute("choice-2", "yes", "そうです", 1),
    ]
    const act = () =>
      FeedbackQuestionEntity.reconstitute(
        "question-1",
        "single_choice",
        "選択してください",
        true,
        0,
        choices
      )

    expect(act).toThrow(InvalidArgumentError)
    expect(act).toThrow(
      'FeedbackChoice value must be unique within question: questionId="question-1", value="yes"'
    )
  })

  it.each([
    {
      field: "slug",
      act: () =>
        FeedbackSurveyEntity.reconstitute(
          "survey-1",
          "",
          "アンケート",
          true,
          []
        ),
      message: 'FeedbackSurvey slug must not be empty: id="survey-1"',
    },
    {
      field: "slug",
      act: () =>
        FeedbackSurveyEntity.reconstitute(
          "survey-1",
          "  ",
          "アンケート",
          true,
          []
        ),
      message: 'FeedbackSurvey slug must not be empty: id="survey-1"',
    },
    {
      field: "title",
      act: () =>
        FeedbackSurveyEntity.reconstitute(
          "survey-1",
          "survey-slug",
          "",
          true,
          []
        ),
      message: 'FeedbackSurvey title must not be empty: id="survey-1"',
    },
    {
      field: "title",
      act: () =>
        FeedbackSurveyEntity.reconstitute(
          "survey-1",
          "survey-slug",
          "  ",
          true,
          []
        ),
      message: 'FeedbackSurvey title must not be empty: id="survey-1"',
    },
  ])("アンケートの空の $field を拒否する", ({ act, message }) => {
    expect(act).toThrow(InvalidArgumentError)
    expect(act).toThrow(message)
  })
})

// 以下は「新しい不変条件」。reconstitute にも効くため、永続データが違反すると
// findActive() 経由で回答者向けフォームが壊れる。seed / schema を変えたら再検証すること。
describe("FeedbackSurveyEntity の不変条件", () => {
  const textQuestion = (id: string, sortOrder: number) =>
    FeedbackQuestionEntity.reconstitute(
      id,
      "text",
      "自由記述",
      false,
      sortOrder,
      []
    )

  it("設問の sortOrder がアンケート内で重複する場合は拒否する", () => {
    const act = () =>
      FeedbackSurveyEntity.reconstitute(
        "survey-1",
        "slug",
        "アンケート",
        true,
        [textQuestion("question-1", 1), textQuestion("question-2", 1)]
      )

    expect(act).toThrow(InvalidArgumentError)
    expect(act).toThrow(
      'FeedbackQuestion sortOrder must be unique within survey: surveyId="survey-1", sortOrder=1'
    )
  })

  it("選択肢の sortOrder が設問内で重複する場合は拒否する", () => {
    const act = () =>
      FeedbackQuestionEntity.reconstitute(
        "question-1",
        "single_choice",
        "選択してください",
        true,
        0,
        [
          FeedbackChoice.reconstitute("choice-1", "yes", "はい", 1),
          FeedbackChoice.reconstitute("choice-2", "no", "いいえ", 1),
        ]
      )

    expect(act).toThrow(InvalidArgumentError)
    expect(act).toThrow(
      'FeedbackChoice sortOrder must be unique within question: questionId="question-1", sortOrder=1'
    )
  })

  it("自由記述設問が選択肢を持つ場合は拒否する", () => {
    const act = () =>
      FeedbackQuestionEntity.reconstitute(
        "question-1",
        "text",
        "自由記述",
        false,
        0,
        [FeedbackChoice.reconstitute("choice-1", "yes", "はい", 0)]
      )

    expect(act).toThrow(InvalidArgumentError)
    expect(act).toThrow(
      'text FeedbackQuestion must not have choices: id="question-1"'
    )
  })

  it.each([
    "Pmf-2026",
    "pmf_2026",
    "pmf 2026",
    "-pmf",
    "pmf-",
    "pmf--2026",
    "pmf/2026",
    "アンケート",
  ])("slug の不正な形式 %s を拒否する", (slug) => {
    const act = () =>
      FeedbackSurveyEntity.reconstitute(
        "survey-1",
        slug,
        "アンケート",
        false,
        []
      )

    expect(act).toThrow(InvalidArgumentError)
    expect(act).toThrow(
      "FeedbackSurvey slug must be lowercase alphanumeric words joined by hyphens"
    )
  })

  it.each(["pmf-2026", "pmf", "2026", "a-b-c-1"])(
    "slug の正当な形式 %s を許可する",
    (slug) => {
      expect(
        FeedbackSurveyEntity.reconstitute(
          "survey-1",
          slug,
          "アンケート",
          false,
          []
        ).slug
      ).toBe(slug)
    }
  )

  it("slug は 64 文字まで許可し 65 文字を拒否する", () => {
    const build = (length: number) =>
      FeedbackSurveyEntity.reconstitute(
        "survey-1",
        "a".repeat(length),
        "アンケート",
        false,
        []
      )

    expect(build(64).slug).toHaveLength(64)
    expect(() => build(65)).toThrow(
      "FeedbackSurvey slug must be 64 characters or fewer"
    )
  })

  it("title は 200 文字まで許可し 201 文字を拒否する", () => {
    const build = (length: number) =>
      FeedbackSurveyEntity.reconstitute(
        "survey-1",
        "slug",
        "あ".repeat(length),
        false,
        []
      )

    expect(build(200).title).toHaveLength(200)
    expect(() => build(201)).toThrow(
      "FeedbackSurvey title must be 200 characters or fewer"
    )
  })

  it("設問 0 件のアンケートは非公開なら許可する（作ってから設問を足す経路を残す）", () => {
    const survey = FeedbackSurveyEntity.reconstitute(
      "survey-1",
      "slug",
      "アンケート",
      false,
      []
    )

    expect(survey.isActive).toBe(false)
    expect(survey.questions).toEqual([])
  })

  it("設問 0 件のアンケートを公開状態で復元しようとすると拒否する", () => {
    const act = () =>
      FeedbackSurveyEntity.reconstitute(
        "survey-1",
        "slug",
        "アンケート",
        true,
        []
      )

    expect(act).toThrow(EmptyActiveFeedbackSurveyError)
    expect(act).toThrow(
      'FeedbackSurvey without questions must not be active: id="survey-1"'
    )
  })
})

describe("FeedbackSurveyEntity.create", () => {
  const draft: FeedbackSurveyDraft = {
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
  }

  it("正当な集約を受け入れ、スカラーをそのまま保持する", () => {
    const survey = FeedbackSurveyEntity.create(draft)

    expect(survey.id).toBe("survey-1")
    expect(survey.slug).toBe("pmf-2026")
    expect(survey.title).toBe("PMFアンケート")
    expect(survey.isActive).toBe(true)
    expect(survey.questions.map((question) => question.id)).toEqual([
      "question-1",
      "question-2",
    ])
  })

  it("設問と選択肢の sortOrder を配列インデックスから導出する", () => {
    const survey = FeedbackSurveyEntity.create(draft)

    expect(survey.questions.map((question) => question.sortOrder)).toEqual([
      0, 1,
    ])
    expect(
      survey.questions[0]?.choices.map((choice) => choice.sortOrder)
    ).toEqual([0, 1])
  })

  it("設問 0 件でも非公開なら作成できる", () => {
    const survey = FeedbackSurveyEntity.create({
      ...draft,
      isActive: false,
      questions: [],
    })

    expect(survey.questions).toEqual([])
  })

  it("設問 0 件を公開状態で作成しようとすると拒否する", () => {
    expect(() =>
      FeedbackSurveyEntity.create({ ...draft, questions: [] })
    ).toThrow(EmptyActiveFeedbackSurveyError)
  })

  it("選択肢のない選択式設問を拒否する", () => {
    expect(() =>
      FeedbackSurveyEntity.create({
        ...draft,
        questions: [
          {
            id: "question-1",
            type: "single_choice",
            text: "どう思いますか？",
            required: true,
            choices: [],
          },
        ],
      })
    ).toThrow(InvalidArgumentError)
  })

  it("不正な slug を拒否する", () => {
    expect(() =>
      FeedbackSurveyEntity.create({ ...draft, slug: "PMF 2026" })
    ).toThrow(InvalidArgumentError)
  })
})

describe("FeedbackSurveyEntity のミューテーター", () => {
  const createSurvey = (isActive = true) =>
    FeedbackSurveyEntity.reconstitute(
      "survey-1",
      "slug",
      "アンケート",
      isActive,
      [
        FeedbackQuestionEntity.reconstitute(
          "question-1",
          "text",
          "自由記述",
          false,
          0,
          []
        ),
      ]
    )

  it("changeTitle はタイトルだけを変えたコピーを返す", () => {
    const original = createSurvey()
    const updated = original.changeTitle("新しいタイトル")

    expect(updated).not.toBe(original)
    expect(updated.title).toBe("新しいタイトル")
    expect(original.title).toBe("アンケート")
    expect(updated.slug).toBe(original.slug)
    expect(updated.isActive).toBe(original.isActive)
    expect(updated.questions).toEqual(original.questions)
  })

  it("changeSlug は slug だけを変えたコピーを返す", () => {
    const original = createSurvey()
    const updated = original.changeSlug("new-slug")

    expect(updated).not.toBe(original)
    expect(updated.slug).toBe("new-slug")
    expect(original.slug).toBe("slug")
    expect(updated.title).toBe(original.title)
  })

  it("changeSlug は不正な形式を拒否する", () => {
    expect(() => createSurvey().changeSlug("New Slug")).toThrow(
      InvalidArgumentError
    )
  })

  it("activate / deactivate は isActive だけを変えたコピーを返す", () => {
    const inactive = createSurvey(false)
    const activated = inactive.activate()

    expect(activated).not.toBe(inactive)
    expect(activated.isActive).toBe(true)
    expect(inactive.isActive).toBe(false)

    const deactivated = activated.deactivate()

    expect(deactivated.isActive).toBe(false)
    expect(activated.isActive).toBe(true)
  })

  it("設問 0 件のアンケートの activate は EmptyActiveFeedbackSurveyError になる", () => {
    const empty = FeedbackSurveyEntity.reconstitute(
      "survey-1",
      "slug",
      "アンケート",
      false,
      []
    )

    expect(() => empty.activate()).toThrow(EmptyActiveFeedbackSurveyError)
    // 公開できないだけで、非公開のままにする操作は常に成功する。
    expect(empty.deactivate().isActive).toBe(false)
  })

  it("非公開アンケートの設問セットを置換し、配列順からsortOrderを導出する", () => {
    const original = createSurvey(false)

    const replaced = original.replaceQuestions([
      {
        id: "new-question",
        type: "single_choice",
        text: "新しい設問",
        required: true,
        choices: [{ id: "new-choice", value: "yes", label: "はい" }],
      },
    ])

    expect(replaced).not.toBe(original)
    expect(replaced.isActive).toBe(false)
    expect(replaced.questions[0]).toMatchObject({
      id: "new-question",
      sortOrder: 0,
    })
    expect(replaced.questions[0]?.choices[0]).toMatchObject({
      id: "new-choice",
      sortOrder: 0,
    })
    expect(original.questions[0]?.id).toBe("question-1")
  })

  it("公開中アンケートの設問置換を拒否する", () => {
    expect(() => createSurvey().replaceQuestions([])).toThrow(
      FeedbackSurveyMustBeInactiveError
    )
  })
})

describe("FeedbackSurveySlugConflictError", () => {
  it("衝突した slug を含むメッセージを持つ", () => {
    const error = new FeedbackSurveySlugConflictError("pmf-2026")

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe("FeedbackSurveySlugConflictError")
    expect(error.message).toBe(
      'FeedbackSurvey slug is already used: "pmf-2026"'
    )
  })
})
