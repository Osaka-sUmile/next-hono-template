import { DomainError, InvalidArgumentError } from "../errors"
import { BaseEntity } from "./base.entity"
import {
  FeedbackQuestionEntity,
  FeedbackSurveyEntity,
} from "./feedback-survey.entity"

const FEEDBACK_TEXT_MAX_LENGTH = 2000

export type FeedbackAnswerInput = {
  questionId: string
  choiceValue?: string
  textValue?: string
}

export type FeedbackSubmissionAnswer = {
  questionId: string
  choiceId: string | null
  textValue: string | null
}

export class RequiredFeedbackAnswerMissingError extends DomainError {
  constructor(questionId: string) {
    super(`Required feedback answer is missing: questionId="${questionId}"`)
  }
}

export class UnknownFeedbackQuestionError extends DomainError {
  constructor(questionId: string) {
    super(`Unknown feedback question: questionId="${questionId}"`)
  }
}

export class DuplicateFeedbackAnswerError extends DomainError {
  constructor(questionId: string) {
    super(`Duplicate feedback answer: questionId="${questionId}"`)
  }
}

export class InvalidFeedbackChoiceError extends DomainError {
  constructor(questionId: string, choiceValue: string) {
    super(
      `Invalid feedback choice: questionId="${questionId}", choiceValue="${choiceValue}"`
    )
  }
}

export class FeedbackAnswerTypeMismatchError extends DomainError {
  constructor(questionId: string, expected: FeedbackQuestionEntity["type"]) {
    super(
      `Feedback answer type mismatch: questionId="${questionId}", expected="${expected}"`
    )
  }
}

export class FeedbackTextTooLongError extends DomainError {
  constructor(questionId: string) {
    super(
      `Feedback text must be ${FEEDBACK_TEXT_MAX_LENGTH} characters or fewer: questionId="${questionId}"`
    )
  }
}

export class FeedbackSubmissionEntity extends BaseEntity<string> {
  readonly answers: readonly FeedbackSubmissionAnswer[]

  private constructor(
    id: string,
    readonly surveyId: string,
    readonly userId: string,
    answers: readonly FeedbackSubmissionAnswer[],
    readonly createdAt: Date
  ) {
    super(id)
    // create / reconstitute のどちらの経路でも守られる最低限の不変条件。
    this.ensure(
      surveyId.trim().length > 0,
      new InvalidArgumentError(
        `FeedbackSubmission surveyId must not be empty: id="${id}"`
      )
    )
    this.ensure(
      userId.trim().length > 0,
      new InvalidArgumentError(
        `FeedbackSubmission userId must not be empty: id="${id}"`
      )
    )
    this.answers = answers.map((answer) => ({ ...answer }))
  }

  static create(
    id: string,
    survey: FeedbackSurveyEntity,
    userId: string,
    inputs: readonly FeedbackAnswerInput[]
  ): FeedbackSubmissionEntity {
    const seenQuestionIds = new Set<string>()
    const answers = inputs.map((input) => {
      const question = survey.findQuestionById(input.questionId)
      if (!question) {
        throw new UnknownFeedbackQuestionError(input.questionId)
      }
      if (seenQuestionIds.has(input.questionId)) {
        throw new DuplicateFeedbackAnswerError(input.questionId)
      }
      seenQuestionIds.add(input.questionId)
      return this.createAnswer(question, input)
    })

    for (const question of survey.questions) {
      if (question.required && !seenQuestionIds.has(question.id)) {
        throw new RequiredFeedbackAnswerMissingError(question.id)
      }
    }

    return new FeedbackSubmissionEntity(
      id,
      survey.id,
      userId,
      answers,
      new Date()
    )
  }

  static reconstitute(
    id: string,
    surveyId: string,
    userId: string,
    answers: readonly FeedbackSubmissionAnswer[],
    createdAt: Date
  ): FeedbackSubmissionEntity {
    return new FeedbackSubmissionEntity(
      id,
      surveyId,
      userId,
      answers,
      createdAt
    )
  }

  private static createAnswer(
    question: FeedbackQuestionEntity,
    input: FeedbackAnswerInput
  ): FeedbackSubmissionAnswer {
    if (question.type === "single_choice") {
      if (input.textValue !== undefined) {
        throw new FeedbackAnswerTypeMismatchError(question.id, question.type)
      }
      // 未回答は自由記述側と対称に扱う: 必須なら拒否し、任意なら null に正規化する。
      // 空白のみの choiceValue も未回答とみなすが、選択肢の突き合わせは
      // 集計キーの取り違えを防ぐため trim せず厳密一致で行う。
      if (
        input.choiceValue === undefined ||
        input.choiceValue.trim().length === 0
      ) {
        if (question.required) {
          throw new RequiredFeedbackAnswerMissingError(question.id)
        }
        return {
          questionId: question.id,
          choiceId: null,
          textValue: null,
        }
      }
      const choice = question.findChoiceByValue(input.choiceValue)
      if (!choice) {
        throw new InvalidFeedbackChoiceError(question.id, input.choiceValue)
      }
      return {
        questionId: question.id,
        choiceId: choice.id,
        textValue: null,
      }
    }

    if (input.choiceValue !== undefined) {
      throw new FeedbackAnswerTypeMismatchError(question.id, question.type)
    }
    if (input.textValue === undefined || input.textValue.trim().length === 0) {
      if (question.required) {
        throw new RequiredFeedbackAnswerMissingError(question.id)
      }
      return {
        questionId: question.id,
        choiceId: null,
        textValue: null,
      }
    }
    if (input.textValue.length > FEEDBACK_TEXT_MAX_LENGTH) {
      throw new FeedbackTextTooLongError(question.id)
    }
    return {
      questionId: question.id,
      choiceId: null,
      textValue: input.textValue,
    }
  }
}
