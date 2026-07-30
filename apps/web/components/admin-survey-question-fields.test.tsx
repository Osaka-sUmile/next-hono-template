import { describe, expect, it } from "vitest"
import {
  createQuestionDrafts,
  serializeQuestions,
  validateQuestions,
  type QuestionDraft,
} from "./admin-survey-question-fields"

describe("createQuestionDrafts", () => {
  it("設問と選択肢に一意の key を付与する", () => {
    const drafts = createQuestionDrafts([
      {
        type: "single_choice",
        text: "満足度",
        required: true,
        choices: [
          { value: "yes", label: "はい" },
          { value: "no", label: "いいえ" },
        ],
      },
    ])

    expect(drafts).toEqual([
      {
        key: 1,
        type: "single_choice",
        text: "満足度",
        required: true,
        choices: [
          { key: 2, value: "yes", label: "はい" },
          { key: 3, value: "no", label: "いいえ" },
        ],
      },
    ])
  })
})

describe("serializeQuestions", () => {
  it("本文と選択肢を trim し、text 種別では選択肢を破棄する", () => {
    const questions: QuestionDraft[] = [
      {
        key: 1,
        type: "text",
        text: "  感想  ",
        required: false,
        choices: [{ key: 2, value: "unused", label: "未使用" }],
      },
      {
        key: 3,
        type: "single_choice",
        text: " 満足度 ",
        required: true,
        choices: [{ key: 4, value: " good ", label: " 良い " }],
      },
    ]

    expect(serializeQuestions(questions)).toEqual([
      {
        type: "text",
        text: "感想",
        required: false,
        choices: [],
      },
      {
        type: "single_choice",
        text: "満足度",
        required: true,
        choices: [{ value: "good", label: "良い" }],
      },
    ])
  })
})

describe("validateQuestions", () => {
  it("有効な設問なら null を返す", () => {
    expect(
      validateQuestions([
        {
          key: 1,
          type: "single_choice",
          text: "満足度",
          required: false,
          choices: [{ key: 2, value: "good", label: "良い" }],
        },
      ])
    ).toBeNull()
  })

  it("本文が空ならエラーを返す", () => {
    expect(
      validateQuestions([
        {
          key: 1,
          type: "text",
          text: "   ",
          required: false,
          choices: [],
        },
      ])
    ).toBe("設問 1 の本文を入力してください。")
  })

  it("単一選択で選択肢が 0 件ならエラーを返す", () => {
    expect(
      validateQuestions([
        {
          key: 1,
          type: "single_choice",
          text: "満足度",
          required: false,
          choices: [],
        },
      ])
    ).toBe("設問 1 には選択肢を 1 つ以上追加してください。")
  })

  it("選択肢の値またはラベルが空ならエラーを返す", () => {
    expect(
      validateQuestions([
        {
          key: 1,
          type: "single_choice",
          text: "満足度",
          required: false,
          choices: [{ key: 2, value: "", label: "良い" }],
        },
      ])
    ).toBe("設問 1 の選択肢 1 の値とラベルを入力してください。")
  })

  it("選択肢の値が重複していればエラーを返す", () => {
    expect(
      validateQuestions([
        {
          key: 1,
          type: "single_choice",
          text: "満足度",
          required: false,
          choices: [
            { key: 2, value: "same", label: "A" },
            { key: 3, value: "same", label: "B" },
          ],
        },
      ])
    ).toBe("設問 1 の選択肢の値が重複しています。")
  })
})
