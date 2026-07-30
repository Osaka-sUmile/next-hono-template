import type {
  FeedbackQuestionDraft,
  FeedbackQuestionType,
  IIdGenerator,
} from "@workspace/domain"

export type FeedbackSurveyQuestionInput = {
  type: FeedbackQuestionType
  text: string
  required: boolean
  choices: readonly { value: string; label: string }[]
}

export function toQuestionDrafts(
  questions: readonly FeedbackSurveyQuestionInput[],
  idGenerator: IIdGenerator
): FeedbackQuestionDraft[] {
  return questions.map((question) => ({
    id: idGenerator.generate(),
    type: question.type,
    text: question.text,
    required: question.required,
    choices: question.choices.map((choice) => ({
      id: idGenerator.generate(),
      value: choice.value,
      label: choice.label,
    })),
  }))
}
