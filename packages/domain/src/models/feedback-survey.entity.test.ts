import { describe, expect, it } from "vitest"
import {
  FeedbackChoice,
  FeedbackQuestionEntity,
  FeedbackSurveyEntity,
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
})
