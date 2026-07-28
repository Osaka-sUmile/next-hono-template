import { describe, expect, it } from "vitest";
import { InvalidArgumentError } from "../errors";
import {
  FeedbackChoice,
  FeedbackQuestionEntity,
  FeedbackSurveyEntity,
  InvalidFeedbackQuestionTypeError,
  parseFeedbackQuestionType,
} from "./feedback-survey.entity";

describe("parseFeedbackQuestionType", () => {
  it.each(["single_choice", "text"] as const)(
    "有効な種別 %s を返す",
    (type) => {
      expect(parseFeedbackQuestionType(type)).toBe(type);
    }
  );

  it("未知の種別は専用エラーと値を含むメッセージで拒否する", () => {
    expect(() => parseFeedbackQuestionType("multiple_choice")).toThrow(
      InvalidFeedbackQuestionTypeError
    );
    expect(() => parseFeedbackQuestionType("multiple_choice")).toThrow(
      'Invalid FeedbackQuestionType: "multiple_choice"'
    );
  });

  it("空文字を拒否する", () => {
    expect(() => parseFeedbackQuestionType("")).toThrow(
      InvalidFeedbackQuestionTypeError
    );
  });
});

describe("FeedbackSurveyEntity", () => {
  it("設問と選択肢を含むアンケートを復元する", () => {
    const choice = FeedbackChoice.reconstitute("choice-1", "yes", "はい", 1);
    const question = FeedbackQuestionEntity.reconstitute(
      "question-1",
      "single_choice",
      "質問ですか？",
      true,
      1,
      [choice]
    );

    const survey = FeedbackSurveyEntity.reconstitute(
      "survey-1",
      "survey-slug",
      "アンケート",
      true,
      [question]
    );

    expect(survey.id).toBe("survey-1");
    expect(survey.slug).toBe("survey-slug");
    expect(survey.title).toBe("アンケート");
    expect(survey.isActive).toBe(true);
    expect(survey.questions).toEqual([question]);
    expect(survey.findQuestionById("question-1")).toBe(question);
    expect(survey.findQuestionById("missing")).toBeNull();
    expect(question.findChoiceByValue("yes")).toBe(choice);
    expect(question.findChoiceByValue("missing")).toBeNull();
  });

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
    expect(act).toThrow(InvalidArgumentError);
    expect(act).toThrow(message);
  });

  it("選択肢の負の sortOrder を拒否し、0 は許可する", () => {
    expect(() =>
      FeedbackChoice.reconstitute("choice-1", "yes", "はい", -1)
    ).toThrow(InvalidArgumentError);
    expect(() =>
      FeedbackChoice.reconstitute("choice-1", "yes", "はい", -1)
    ).toThrow('FeedbackChoice sortOrder must be non-negative: id="choice-1"');
    expect(
      FeedbackChoice.reconstitute("choice-1", "yes", "はい", 0).sortOrder
    ).toBe(0);
  });

  it.each(["", "  "])("設問の空の text を拒否する", (text) => {
    const act = () =>
      FeedbackQuestionEntity.reconstitute(
        "question-1",
        "text",
        text,
        false,
        0,
        []
      );

    expect(act).toThrow(InvalidArgumentError);
    expect(act).toThrow(
      'FeedbackQuestion text must not be empty: id="question-1"'
    );
  });

  it("設問の負の sortOrder を拒否し、0 は許可する", () => {
    const createQuestion = (sortOrder: number) =>
      FeedbackQuestionEntity.reconstitute(
        "question-1",
        "text",
        "自由記述",
        false,
        sortOrder,
        []
      );

    expect(() => createQuestion(-1)).toThrow(InvalidArgumentError);
    expect(() => createQuestion(-1)).toThrow(
      'FeedbackQuestion sortOrder must be non-negative: id="question-1"'
    );
    expect(createQuestion(0).sortOrder).toBe(0);
  });

  it("選択式設問に選択肢がない場合は拒否する", () => {
    const act = () =>
      FeedbackQuestionEntity.reconstitute(
        "question-1",
        "single_choice",
        "選択してください",
        true,
        0,
        []
      );

    expect(act).toThrow(InvalidArgumentError);
    expect(act).toThrow(
      'single_choice FeedbackQuestion must have at least one choice: id="question-1"'
    );
  });

  it("設問内で重複する選択肢 value を拒否する", () => {
    const choices = [
      FeedbackChoice.reconstitute("choice-1", "yes", "はい", 0),
      FeedbackChoice.reconstitute("choice-2", "yes", "そうです", 1),
    ];
    const act = () =>
      FeedbackQuestionEntity.reconstitute(
        "question-1",
        "single_choice",
        "選択してください",
        true,
        0,
        choices
      );

    expect(act).toThrow(InvalidArgumentError);
    expect(act).toThrow(
      'FeedbackChoice value must be unique within question: questionId="question-1", value="yes"'
    );
  });

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
    expect(act).toThrow(InvalidArgumentError);
    expect(act).toThrow(message);
  });
});
