import { DomainError, InvalidArgumentError } from "../errors"
import { BaseEntity } from "./base.entity"

export type FeedbackQuestionType = "single_choice" | "text"

const FEEDBACK_QUESTION_TYPES: ReadonlySet<string> =
  new Set<FeedbackQuestionType>(["single_choice", "text"])

/** 公開 URL のキーであり `FeedbackSurvey.slug` は `@unique`。形式を狭く固定しておく。 */
const FEEDBACK_SURVEY_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const FEEDBACK_SURVEY_SLUG_MAX_LENGTH = 64
export const FEEDBACK_SURVEY_TITLE_MAX_LENGTH = 200

export class InvalidFeedbackQuestionTypeError extends DomainError {
  constructor(value: string) {
    super(`Invalid FeedbackQuestionType: "${value}"`)
  }
}

/** slug は `@unique` なので、永続化時の衝突を Repository がこのエラーへ翻訳する。 */
export class FeedbackSurveySlugConflictError extends DomainError {
  constructor(slug: string) {
    super(`FeedbackSurvey slug is already used: "${slug}"`)
  }
}

export class EmptyActiveFeedbackSurveyError extends DomainError {
  constructor(id: string) {
    super(`FeedbackSurvey without questions must not be active: id="${id}"`)
  }
}

export class FeedbackSurveyMustBeInactiveError extends DomainError {
  constructor(id: string) {
    super(`FeedbackSurvey must be inactive for this operation: id="${id}"`)
  }
}

export class FeedbackSurveyHasSubmissionsError extends DomainError {
  constructor(id: string) {
    super(`FeedbackSurvey with submissions cannot be changed: id="${id}"`)
  }
}

export function parseFeedbackQuestionType(value: string): FeedbackQuestionType {
  if (!FEEDBACK_QUESTION_TYPES.has(value)) {
    throw new InvalidFeedbackQuestionTypeError(value)
  }
  return value as FeedbackQuestionType
}

/** 新規作成時の選択肢。`sortOrder` は配列インデックスから導出するため受け取らない。 */
export type FeedbackChoiceDraft = {
  id: string
  value: string
  label: string
}

/** 新規作成時の設問。`sortOrder` は配列インデックスから導出するため受け取らない。 */
export type FeedbackQuestionDraft = {
  id: string
  type: FeedbackQuestionType
  text: string
  required: boolean
  choices: readonly FeedbackChoiceDraft[]
}

export type FeedbackSurveyDraft = {
  id: string
  slug: string
  title: string
  isActive: boolean
  questions: readonly FeedbackQuestionDraft[]
}

export class FeedbackChoice extends BaseEntity<string> {
  private constructor(
    id: string,
    readonly value: string,
    readonly label: string,
    readonly sortOrder: number
  ) {
    super(id)
    this.ensure(
      value.trim().length > 0,
      new InvalidArgumentError(
        `FeedbackChoice value must not be empty: id="${id}"`
      )
    )
    this.ensure(
      label.trim().length > 0,
      new InvalidArgumentError(
        `FeedbackChoice label must not be empty: id="${id}"`
      )
    )
    this.ensure(
      sortOrder >= 0,
      new InvalidArgumentError(
        `FeedbackChoice sortOrder must be non-negative: id="${id}"`
      )
    )
  }

  static create(draft: FeedbackChoiceDraft, sortOrder: number): FeedbackChoice {
    return new FeedbackChoice(draft.id, draft.value, draft.label, sortOrder)
  }

  static reconstitute(
    id: string,
    value: string,
    label: string,
    sortOrder: number
  ): FeedbackChoice {
    return new FeedbackChoice(id, value, label, sortOrder)
  }
}

export class FeedbackQuestionEntity extends BaseEntity<string> {
  readonly choices: readonly FeedbackChoice[]

  private constructor(
    id: string,
    readonly type: FeedbackQuestionType,
    readonly text: string,
    readonly required: boolean,
    readonly sortOrder: number,
    choices: readonly FeedbackChoice[]
  ) {
    super(id)
    this.ensure(
      text.trim().length > 0,
      new InvalidArgumentError(
        `FeedbackQuestion text must not be empty: id="${id}"`
      )
    )
    this.ensure(
      sortOrder >= 0,
      new InvalidArgumentError(
        `FeedbackQuestion sortOrder must be non-negative: id="${id}"`
      )
    )
    this.ensure(
      type !== "single_choice" || choices.length > 0,
      new InvalidArgumentError(
        `single_choice FeedbackQuestion must have at least one choice: id="${id}"`
      )
    )
    this.ensure(
      type !== "text" || choices.length === 0,
      new InvalidArgumentError(
        `text FeedbackQuestion must not have choices: id="${id}"`
      )
    )
    const choiceValues = new Set<string>()
    const choiceSortOrders = new Set<number>()
    for (const choice of choices) {
      this.ensure(
        !choiceValues.has(choice.value),
        new InvalidArgumentError(
          `FeedbackChoice value must be unique within question: questionId="${id}", value="${choice.value}"`
        )
      )
      choiceValues.add(choice.value)
      // @@unique([questionId, sortOrder]) の写し。永続化前に検出する。
      this.ensure(
        !choiceSortOrders.has(choice.sortOrder),
        new InvalidArgumentError(
          `FeedbackChoice sortOrder must be unique within question: questionId="${id}", sortOrder=${choice.sortOrder}`
        )
      )
      choiceSortOrders.add(choice.sortOrder)
    }
    this.choices = [...choices]
  }

  /** 選択肢の `sortOrder` は `draft.choices` の並び順（インデックス）から導出する。 */
  static create(
    draft: FeedbackQuestionDraft,
    sortOrder: number
  ): FeedbackQuestionEntity {
    return new FeedbackQuestionEntity(
      draft.id,
      draft.type,
      draft.text,
      draft.required,
      sortOrder,
      draft.choices.map((choice, index) => FeedbackChoice.create(choice, index))
    )
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
    )
  }

  findChoiceByValue(value: string): FeedbackChoice | null {
    return this.choices.find((choice) => choice.value === value) ?? null
  }
}

export class FeedbackSurveyEntity extends BaseEntity<string> {
  readonly questions: readonly FeedbackQuestionEntity[]

  private constructor(
    id: string,
    readonly slug: string,
    readonly title: string,
    readonly isActive: boolean,
    questions: readonly FeedbackQuestionEntity[]
  ) {
    super(id)
    this.ensure(
      slug.trim().length > 0,
      new InvalidArgumentError(
        `FeedbackSurvey slug must not be empty: id="${id}"`
      )
    )
    this.ensure(
      title.trim().length > 0,
      new InvalidArgumentError(
        `FeedbackSurvey title must not be empty: id="${id}"`
      )
    )
    this.ensure(
      slug.length <= FEEDBACK_SURVEY_SLUG_MAX_LENGTH,
      new InvalidArgumentError(
        `FeedbackSurvey slug must be ${FEEDBACK_SURVEY_SLUG_MAX_LENGTH} characters or fewer: id="${id}"`
      )
    )
    this.ensure(
      FEEDBACK_SURVEY_SLUG_REGEX.test(slug),
      new InvalidArgumentError(
        `FeedbackSurvey slug must be lowercase alphanumeric words joined by hyphens: id="${id}", slug="${slug}"`
      )
    )
    this.ensure(
      title.length <= FEEDBACK_SURVEY_TITLE_MAX_LENGTH,
      new InvalidArgumentError(
        `FeedbackSurvey title must be ${FEEDBACK_SURVEY_TITLE_MAX_LENGTH} characters or fewer: id="${id}"`
      )
    )
    const questionSortOrders = new Set<number>()
    for (const question of questions) {
      // @@unique([surveyId, sortOrder]) の写し。永続化前に検出する。
      this.ensure(
        !questionSortOrders.has(question.sortOrder),
        new InvalidArgumentError(
          `FeedbackQuestion sortOrder must be unique within survey: surveyId="${id}", sortOrder=${question.sortOrder}`
        )
      )
      questionSortOrders.add(question.sortOrder)
    }
    // 設問 0 件そのものは禁止しない（「作ってから設問を足す」経路を残す）が、
    // 回答不能なアンケートを公開状態にはしない。
    this.ensure(
      questions.length > 0 || !isActive,
      new EmptyActiveFeedbackSurveyError(id)
    )
    this.questions = [...questions]
  }

  /** 設問の `sortOrder` は `draft.questions` の並び順（インデックス）から導出する。 */
  static create(draft: FeedbackSurveyDraft): FeedbackSurveyEntity {
    return new FeedbackSurveyEntity(
      draft.id,
      draft.slug,
      draft.title,
      draft.isActive,
      draft.questions.map((question, index) =>
        FeedbackQuestionEntity.create(question, index)
      )
    )
  }

  static reconstitute(
    id: string,
    slug: string,
    title: string,
    isActive: boolean,
    questions: readonly FeedbackQuestionEntity[]
  ): FeedbackSurveyEntity {
    return new FeedbackSurveyEntity(id, slug, title, isActive, questions)
  }

  findQuestionById(id: string): FeedbackQuestionEntity | null {
    return this.questions.find((question) => question.id === id) ?? null
  }

  // 以下のミューテーターはすべて新しいインスタンスを返し、このインスタンスは変更しない。
  // 検証はコンストラクタに集約されているため、new を通すことで自動的に再検証される。

  changeTitle(title: string): FeedbackSurveyEntity {
    return new FeedbackSurveyEntity(
      this.id,
      this.slug,
      title,
      this.isActive,
      this.questions
    )
  }

  changeSlug(slug: string): FeedbackSurveyEntity {
    return new FeedbackSurveyEntity(
      this.id,
      slug,
      this.title,
      this.isActive,
      this.questions
    )
  }

  /** 設問が 1 件も無いアンケートは公開できず `EmptyActiveFeedbackSurveyError` になる。 */
  activate(): FeedbackSurveyEntity {
    return new FeedbackSurveyEntity(
      this.id,
      this.slug,
      this.title,
      true,
      this.questions
    )
  }

  deactivate(): FeedbackSurveyEntity {
    return new FeedbackSurveyEntity(
      this.id,
      this.slug,
      this.title,
      false,
      this.questions
    )
  }

  /**
   * 未公開の下書きに限り、設問セット全体を差し替える。
   * 提出件数は Entity が保持しないため、Repository でも同じ inactive 条件と
   * submission 0 件をトランザクション内で再検証する。
   */
  replaceQuestions(
    questions: readonly FeedbackQuestionDraft[]
  ): FeedbackSurveyEntity {
    if (this.isActive) {
      throw new FeedbackSurveyMustBeInactiveError(this.id)
    }
    return FeedbackSurveyEntity.create({
      id: this.id,
      slug: this.slug,
      title: this.title,
      isActive: false,
      questions,
    })
  }
}
