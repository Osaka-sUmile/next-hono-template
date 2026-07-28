import { DomainError, InvalidArgumentError } from "../errors";
import { BaseEntity } from "./base.entity";

export type FeedbackQuestionType = "single_choice" | "text";

const FEEDBACK_QUESTION_TYPES: ReadonlySet<string> =
  new Set<FeedbackQuestionType>(["single_choice", "text"]);

export class InvalidFeedbackQuestionTypeError extends DomainError {
  constructor(value: string) {
    super(`Invalid FeedbackQuestionType: "${value}"`);
  }
}

export function parseFeedbackQuestionType(value: string): FeedbackQuestionType {
  if (!FEEDBACK_QUESTION_TYPES.has(value)) {
    throw new InvalidFeedbackQuestionTypeError(value);
  }
  return value as FeedbackQuestionType;
}

export class FeedbackChoice extends BaseEntity<string> {
  private constructor(
    id: string,
    readonly value: string,
    readonly label: string,
    readonly sortOrder: number
  ) {
    super(id);
    this.ensure(
      value.trim().length > 0,
      new InvalidArgumentError(
        `FeedbackChoice value must not be empty: id="${id}"`
      )
    );
    this.ensure(
      label.trim().length > 0,
      new InvalidArgumentError(
        `FeedbackChoice label must not be empty: id="${id}"`
      )
    );
    this.ensure(
      sortOrder >= 0,
      new InvalidArgumentError(
        `FeedbackChoice sortOrder must be non-negative: id="${id}"`
      )
    );
  }

  static reconstitute(
    id: string,
    value: string,
    label: string,
    sortOrder: number
  ): FeedbackChoice {
    return new FeedbackChoice(id, value, label, sortOrder);
  }
}

export class FeedbackQuestionEntity extends BaseEntity<string> {
  readonly choices: readonly FeedbackChoice[];

  private constructor(
    id: string,
    readonly type: FeedbackQuestionType,
    readonly text: string,
    readonly required: boolean,
    readonly sortOrder: number,
    choices: readonly FeedbackChoice[]
  ) {
    super(id);
    this.ensure(
      text.trim().length > 0,
      new InvalidArgumentError(
        `FeedbackQuestion text must not be empty: id="${id}"`
      )
    );
    this.ensure(
      sortOrder >= 0,
      new InvalidArgumentError(
        `FeedbackQuestion sortOrder must be non-negative: id="${id}"`
      )
    );
    this.ensure(
      type !== "single_choice" || choices.length > 0,
      new InvalidArgumentError(
        `single_choice FeedbackQuestion must have at least one choice: id="${id}"`
      )
    );
    const choiceValues = new Set<string>();
    for (const choice of choices) {
      this.ensure(
        !choiceValues.has(choice.value),
        new InvalidArgumentError(
          `FeedbackChoice value must be unique within question: questionId="${id}", value="${choice.value}"`
        )
      );
      choiceValues.add(choice.value);
    }
    this.choices = [...choices];
  }

  static reconstitute(
    id: string,
    type: FeedbackQuestionType,
    text: string,
    required: boolean,
    sortOrder: number,
    choices: readonly FeedbackChoice[]
  ): FeedbackQuestionEntity {
    return new FeedbackQuestionEntity(
      id,
      type,
      text,
      required,
      sortOrder,
      choices
    );
  }

  findChoiceByValue(value: string): FeedbackChoice | null {
    return this.choices.find((choice) => choice.value === value) ?? null;
  }
}

export class FeedbackSurveyEntity extends BaseEntity<string> {
  readonly questions: readonly FeedbackQuestionEntity[];

  private constructor(
    id: string,
    readonly slug: string,
    readonly title: string,
    readonly isActive: boolean,
    questions: readonly FeedbackQuestionEntity[]
  ) {
    super(id);
    this.ensure(
      slug.trim().length > 0,
      new InvalidArgumentError(
        `FeedbackSurvey slug must not be empty: id="${id}"`
      )
    );
    this.ensure(
      title.trim().length > 0,
      new InvalidArgumentError(
        `FeedbackSurvey title must not be empty: id="${id}"`
      )
    );
    this.questions = [...questions];
  }

  static reconstitute(
    id: string,
    slug: string,
    title: string,
    isActive: boolean,
    questions: readonly FeedbackQuestionEntity[]
  ): FeedbackSurveyEntity {
    return new FeedbackSurveyEntity(id, slug, title, isActive, questions);
  }

  findQuestionById(id: string): FeedbackQuestionEntity | null {
    return this.questions.find((question) => question.id === id) ?? null;
  }
}
