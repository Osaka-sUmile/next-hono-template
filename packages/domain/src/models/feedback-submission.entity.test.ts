import { describe, expect, it } from "vitest"
import {
  DuplicateFeedbackAnswerError,
  FeedbackAnswerTypeMismatchError,
  FeedbackChoice,
  FeedbackQuestionEntity,
  FeedbackSubmissionEntity,
  FeedbackSurveyEntity,
  FeedbackTextTooLongError,
  InvalidFeedbackChoiceError,
  RequiredFeedbackAnswerMissingError,
  UnknownFeedbackQuestionError,
} from "./index"

const createSurvey = (): FeedbackSurveyEntity =>
  FeedbackSurveyEntity.reconstitute(
    "survey-1",
    "pmf-2026",
    "PMFアンケート",
    true,
    [
      FeedbackQuestionEntity.reconstitute(
        "choice-question",
        "single_choice",
        "選択してください",
        true,
        1,
        [
          FeedbackChoice.reconstitute("choice-yes", "yes", "はい", 1),
          FeedbackChoice.reconstitute("choice-no", "no", "いいえ", 2),
        ]
      ),
      FeedbackQuestionEntity.reconstitute(
        "text-question",
        "text",
        "自由に記述してください",
        true,
        2,
        []
      ),
      FeedbackQuestionEntity.reconstitute(
        "optional-question",
        "text",
        "任意回答",
        false,
        3,
        []
      ),
    ]
  )

describe("FeedbackSubmissionEntity.create", () => {
  it("設問定義に沿った選択式・自由記述回答を生成する", () => {
    const before = new Date()
    const submission = FeedbackSubmissionEntity.create(
      "submission-1",
      createSurvey(),
      "user-1",
      [
        { questionId: "choice-question", choiceValue: "yes" },
        { questionId: "text-question", textValue: "価値があります" },
      ]
    )
    const after = new Date()

    expect(submission.id).toBe("submission-1")
    expect(submission.surveyId).toBe("survey-1")
    expect(submission.userId).toBe("user-1")
    expect(submission.answers).toEqual([
      {
        questionId: "choice-question",
        choiceId: "choice-yes",
        textValue: null,
      },
      {
        questionId: "text-question",
        choiceId: null,
        textValue: "価値があります",
      },
    ])
    expect(submission.createdAt.getTime()).toBeGreaterThanOrEqual(
      before.getTime()
    )
    expect(submission.createdAt.getTime()).toBeLessThanOrEqual(after.getTime())
  })

  it("任意設問は未回答でも生成できる", () => {
    const submission = FeedbackSubmissionEntity.create(
      "submission-1",
      createSurvey(),
      "user-1",
      [
        { questionId: "choice-question", choiceValue: "no" },
        { questionId: "text-question", textValue: "回答" },
      ]
    )

    expect(submission.answers).toHaveLength(2)
  })

  it("任意の自由記述に通常の回答を設定できる", () => {
    const submission = FeedbackSubmissionEntity.create(
      "submission-1",
      createSurvey(),
      "user-1",
      [
        { questionId: "choice-question", choiceValue: "no" },
        { questionId: "text-question", textValue: "回答" },
        { questionId: "optional-question", textValue: "任意回答" },
      ]
    )

    expect(submission.answers[2]).toEqual({
      questionId: "optional-question",
      choiceId: null,
      textValue: "任意回答",
    })
  })

  it.each([undefined, "", "  "])(
    "任意の自由記述の未回答値 %s は null に正規化する",
    (textValue) => {
      const submission = FeedbackSubmissionEntity.create(
        "submission-1",
        createSurvey(),
        "user-1",
        [
          { questionId: "choice-question", choiceValue: "no" },
          { questionId: "text-question", textValue: "回答" },
          { questionId: "optional-question", textValue },
        ]
      )

      expect(submission.answers[2]).toEqual({
        questionId: "optional-question",
        choiceId: null,
        textValue: null,
      })
    }
  )

  it("任意の自由記述に choiceValue を渡した場合は種別ミスマッチで拒否する", () => {
    const act = () =>
      FeedbackSubmissionEntity.create(
        "submission-1",
        createSurvey(),
        "user-1",
        [
          { questionId: "choice-question", choiceValue: "no" },
          { questionId: "text-question", textValue: "回答" },
          { questionId: "optional-question", choiceValue: "yes" },
        ]
      )

    expect(act).toThrow(FeedbackAnswerTypeMismatchError)
    expect(act).toThrow(
      'Feedback answer type mismatch: questionId="optional-question", expected="text"'
    )
  })

  it("必須設問の回答がない場合は専用エラーと questionId を含むメッセージで拒否する", () => {
    const act = () =>
      FeedbackSubmissionEntity.create(
        "submission-1",
        createSurvey(),
        "user-1",
        [{ questionId: "choice-question", choiceValue: "yes" }]
      )

    expect(act).toThrow(RequiredFeedbackAnswerMissingError)
    expect(act).toThrow(
      'Required feedback answer is missing: questionId="text-question"'
    )
  })

  it.each(["", "  "])(
    "必須の自由記述が空の場合は未回答として拒否する",
    (textValue) => {
      const act = () =>
        FeedbackSubmissionEntity.create(
          "submission-1",
          createSurvey(),
          "user-1",
          [
            { questionId: "choice-question", choiceValue: "yes" },
            { questionId: "text-question", textValue },
          ]
        )

      expect(act).toThrow(RequiredFeedbackAnswerMissingError)
      expect(act).toThrow(
        'Required feedback answer is missing: questionId="text-question"'
      )
    }
  )

  it("必須の選択式設問に choiceValue がない場合は未回答として拒否する", () => {
    const act = () =>
      FeedbackSubmissionEntity.create(
        "submission-1",
        createSurvey(),
        "user-1",
        [
          { questionId: "choice-question" },
          { questionId: "text-question", textValue: "回答" },
        ]
      )

    expect(act).toThrow(RequiredFeedbackAnswerMissingError)
    expect(act).toThrow(
      'Required feedback answer is missing: questionId="choice-question"'
    )
  })

  it("必須の自由記述設問に textValue がない場合は未回答として拒否する", () => {
    const act = () =>
      FeedbackSubmissionEntity.create(
        "submission-1",
        createSurvey(),
        "user-1",
        [
          { questionId: "choice-question", choiceValue: "yes" },
          { questionId: "text-question" },
        ]
      )

    expect(act).toThrow(RequiredFeedbackAnswerMissingError)
    expect(act).toThrow(
      'Required feedback answer is missing: questionId="text-question"'
    )
  })

  it("未知の questionId を専用エラーと値を含むメッセージで拒否する", () => {
    const act = () =>
      FeedbackSubmissionEntity.create(
        "submission-1",
        createSurvey(),
        "user-1",
        [
          { questionId: "choice-question", choiceValue: "yes" },
          { questionId: "text-question", textValue: "回答" },
          { questionId: "unknown-question", textValue: "不正" },
        ]
      )

    expect(act).toThrow(UnknownFeedbackQuestionError)
    expect(act).toThrow(
      'Unknown feedback question: questionId="unknown-question"'
    )
  })

  it("同じ questionId の重複回答を拒否する", () => {
    const act = () =>
      FeedbackSubmissionEntity.create(
        "submission-1",
        createSurvey(),
        "user-1",
        [
          { questionId: "choice-question", choiceValue: "yes" },
          { questionId: "choice-question", choiceValue: "no" },
          { questionId: "text-question", textValue: "回答" },
        ]
      )

    expect(act).toThrow(DuplicateFeedbackAnswerError)
    expect(act).toThrow(
      'Duplicate feedback answer: questionId="choice-question"'
    )
  })

  it("定義にない choiceValue を専用エラーと値を含むメッセージで拒否する", () => {
    const act = () =>
      FeedbackSubmissionEntity.create(
        "submission-1",
        createSurvey(),
        "user-1",
        [
          { questionId: "choice-question", choiceValue: "unknown" },
          { questionId: "text-question", textValue: "回答" },
        ]
      )

    expect(act).toThrow(InvalidFeedbackChoiceError)
    expect(act).toThrow(
      'Invalid feedback choice: questionId="choice-question", choiceValue="unknown"'
    )
  })

  it("選択式設問への textValue を種別不一致として拒否する", () => {
    const act = () =>
      FeedbackSubmissionEntity.create(
        "submission-1",
        createSurvey(),
        "user-1",
        [
          {
            questionId: "choice-question",
            choiceValue: "yes",
            textValue: "不正",
          },
          { questionId: "text-question", textValue: "回答" },
        ]
      )

    expect(act).toThrow(FeedbackAnswerTypeMismatchError)
    expect(act).toThrow(
      'Feedback answer type mismatch: questionId="choice-question", expected="single_choice"'
    )
  })

  it("自由記述設問への choiceValue を種別不一致として拒否する", () => {
    const act = () =>
      FeedbackSubmissionEntity.create(
        "submission-1",
        createSurvey(),
        "user-1",
        [
          { questionId: "choice-question", choiceValue: "yes" },
          { questionId: "text-question", choiceValue: "yes" },
        ]
      )

    expect(act).toThrow(FeedbackAnswerTypeMismatchError)
    expect(act).toThrow(
      'Feedback answer type mismatch: questionId="text-question", expected="text"'
    )
  })

  it("自由記述は2000文字ちょうどまで許可する", () => {
    const textValue = "あ".repeat(2000)

    const submission = FeedbackSubmissionEntity.create(
      "submission-1",
      createSurvey(),
      "user-1",
      [
        { questionId: "choice-question", choiceValue: "yes" },
        { questionId: "text-question", textValue },
      ]
    )

    expect(submission.answers[1]?.textValue).toBe(textValue)
  })

  it("自由記述が2001文字の場合は専用エラーと上限を含むメッセージで拒否する", () => {
    const act = () =>
      FeedbackSubmissionEntity.create(
        "submission-1",
        createSurvey(),
        "user-1",
        [
          { questionId: "choice-question", choiceValue: "yes" },
          { questionId: "text-question", textValue: "あ".repeat(2001) },
        ]
      )

    expect(act).toThrow(FeedbackTextTooLongError)
    expect(act).toThrow(
      'Feedback text must be 2000 characters or fewer: questionId="text-question"'
    )
  })
})

describe("FeedbackSubmissionEntity.reconstitute", () => {
  it("永続化済みの回答と createdAt をそのまま復元する", () => {
    const createdAt = new Date("2026-07-26T00:00:00.000Z")
    const answers = [
      {
        questionId: "choice-question",
        choiceId: "choice-yes",
        textValue: null,
      },
    ]

    const submission = FeedbackSubmissionEntity.reconstitute(
      "submission-1",
      "survey-1",
      "user-1",
      answers,
      createdAt
    )

    expect(submission.id).toBe("submission-1")
    expect(submission.surveyId).toBe("survey-1")
    expect(submission.userId).toBe("user-1")
    expect(submission.answers).toEqual(answers)
    expect(submission.createdAt).toBe(createdAt)
  })
})
