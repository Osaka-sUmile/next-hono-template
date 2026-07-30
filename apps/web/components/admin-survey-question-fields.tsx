"use client"

import { useRef } from "react"
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Switch } from "@workspace/ui/components/switch"
import { Textarea } from "@workspace/ui/components/textarea"

export const QUESTION_TEXT_MAX_LENGTH = 2000
export const CHOICE_VALUE_MAX_LENGTH = 100
export const CHOICE_LABEL_MAX_LENGTH = 200
export const QUESTIONS_MAX_COUNT = 50
export const CHOICES_MAX_COUNT = 20

export type QuestionType = "single_choice" | "text"

export type ChoiceDraft = {
  key: number
  value: string
  label: string
}

export type QuestionDraft = {
  key: number
  type: QuestionType
  text: string
  required: boolean
  choices: ChoiceDraft[]
}

export type QuestionInput = {
  type: QuestionType
  text: string
  required: boolean
  choices: { value: string; label: string }[]
}

type StoredQuestion = {
  type: QuestionType
  text: string
  required: boolean
  choices: readonly { value: string; label: string }[]
}

export function createQuestionDrafts(
  questions: readonly StoredQuestion[]
): QuestionDraft[] {
  let key = 0
  return questions.map((question) => ({
    key: ++key,
    type: question.type,
    text: question.text,
    required: question.required,
    choices: question.choices.map((choice) => ({
      key: ++key,
      value: choice.value,
      label: choice.label,
    })),
  }))
}

export function serializeQuestions(
  questions: readonly QuestionDraft[]
): QuestionInput[] {
  return questions.map((question) => ({
    type: question.type,
    text: question.text.trim(),
    required: question.required,
    choices:
      question.type === "single_choice"
        ? question.choices.map((choice) => ({
            value: choice.value.trim(),
            label: choice.label.trim(),
          }))
        : [],
  }))
}

/**
 * API の Zod スキーマと同じ制約を送信前に確認し、修正箇所をすぐ示す。
 */
export function validateQuestions(
  questions: readonly QuestionDraft[]
): string | null {
  for (const [index, question] of questions.entries()) {
    const number = index + 1
    if (question.text.trim() === "") {
      return `設問 ${number} の本文を入力してください。`
    }
    if (question.type !== "single_choice") continue
    if (question.choices.length === 0) {
      return `設問 ${number} には選択肢を 1 つ以上追加してください。`
    }
    const seenValues = new Set<string>()
    for (const [choiceIndex, choice] of question.choices.entries()) {
      const choiceNumber = choiceIndex + 1
      if (choice.value.trim() === "" || choice.label.trim() === "") {
        return `設問 ${number} の選択肢 ${choiceNumber} の値とラベルを入力してください。`
      }
      if (seenValues.has(choice.value.trim())) {
        return `設問 ${number} の選択肢の値が重複しています。`
      }
      seenValues.add(choice.value.trim())
    }
  }
  return null
}

type AdminSurveyQuestionFieldsProps = {
  idPrefix: string
  questions: QuestionDraft[]
  onChange: (questions: QuestionDraft[]) => void
  disabled?: boolean
  emptyMessage: string
}

/**
 * アンケート作成と設問置換で共有する設問入力欄。
 */
export function AdminSurveyQuestionFields({
  idPrefix,
  questions,
  onChange,
  disabled = false,
  emptyMessage,
}: AdminSurveyQuestionFieldsProps) {
  const nextKeyRef = useRef(
    questions.reduce(
      (max, question) =>
        Math.max(
          max,
          question.key,
          ...question.choices.map((choice) => choice.key)
        ),
      0
    )
  )

  function nextKey() {
    nextKeyRef.current += 1
    return nextKeyRef.current
  }

  function addQuestion() {
    onChange([
      ...questions,
      {
        key: nextKey(),
        type: "single_choice",
        text: "",
        required: false,
        choices: [{ key: nextKey(), value: "", label: "" }],
      },
    ])
  }

  function updateQuestion(key: number, patch: Partial<QuestionDraft>) {
    onChange(
      questions.map((question) =>
        question.key === key ? { ...question, ...patch } : question
      )
    )
  }

  function removeQuestion(key: number) {
    onChange(questions.filter((question) => question.key !== key))
  }

  function addChoice(questionKey: number) {
    onChange(
      questions.map((question) =>
        question.key === questionKey
          ? {
              ...question,
              choices: [
                ...question.choices,
                { key: nextKey(), value: "", label: "" },
              ],
            }
          : question
      )
    )
  }

  function updateChoice(
    questionKey: number,
    choiceKey: number,
    patch: Partial<ChoiceDraft>
  ) {
    onChange(
      questions.map((question) =>
        question.key === questionKey
          ? {
              ...question,
              choices: question.choices.map((choice) =>
                choice.key === choiceKey ? { ...choice, ...patch } : choice
              ),
            }
          : question
      )
    )
  }

  function removeChoice(questionKey: number, choiceKey: number) {
    onChange(
      questions.map((question) =>
        question.key === questionKey
          ? {
              ...question,
              choices: question.choices.filter(
                (choice) => choice.key !== choiceKey
              ),
            }
          : question
      )
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">設問</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addQuestion}
          disabled={disabled || questions.length >= QUESTIONS_MAX_COUNT}
        >
          <HugeiconsIcon icon={Add01Icon} />
          設問を追加
        </Button>
      </div>
      {questions.length === 0 && (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      )}
      {questions.map((question, index) => (
        <div
          key={question.key}
          className="flex flex-col gap-4 rounded-lg border p-4"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">設問 {index + 1}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => removeQuestion(question.key)}
              aria-label={`設問 ${index + 1} を削除`}
            >
              <HugeiconsIcon icon={Delete02Icon} />
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${idPrefix}-question-${question.key}-type`}>
              種別
            </Label>
            <Select
              value={question.type}
              disabled={disabled}
              onValueChange={(value) =>
                updateQuestion(question.key, {
                  type: value as QuestionType,
                })
              }
            >
              <SelectTrigger
                id={`${idPrefix}-question-${question.key}-type`}
                className="w-48"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single_choice">単一選択</SelectItem>
                <SelectItem value="text">自由記述</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${idPrefix}-question-${question.key}-text`}>
              本文
            </Label>
            <Textarea
              id={`${idPrefix}-question-${question.key}-text`}
              value={question.text}
              disabled={disabled}
              maxLength={QUESTION_TEXT_MAX_LENGTH}
              onChange={(event) =>
                updateQuestion(question.key, { text: event.target.value })
              }
              placeholder="設問の本文を入力"
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id={`${idPrefix}-question-${question.key}-required`}
              checked={question.required}
              disabled={disabled}
              onCheckedChange={(checked) =>
                updateQuestion(question.key, { required: checked })
              }
            />
            <Label htmlFor={`${idPrefix}-question-${question.key}-required`}>
              回答を必須にする
            </Label>
          </div>
          {question.type === "single_choice" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">選択肢</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addChoice(question.key)}
                  disabled={
                    disabled || question.choices.length >= CHOICES_MAX_COUNT
                  }
                >
                  <HugeiconsIcon icon={Add01Icon} />
                  選択肢を追加
                </Button>
              </div>
              {question.choices.map((choice, choiceIndex) => (
                <div key={choice.key} className="flex items-end gap-2">
                  <div className="flex flex-1 flex-col gap-1">
                    <Label
                      htmlFor={`${idPrefix}-choice-${choice.key}-value`}
                      className="text-xs text-muted-foreground"
                    >
                      値
                    </Label>
                    <Input
                      id={`${idPrefix}-choice-${choice.key}-value`}
                      value={choice.value}
                      disabled={disabled}
                      maxLength={CHOICE_VALUE_MAX_LENGTH}
                      onChange={(event) =>
                        updateChoice(question.key, choice.key, {
                          value: event.target.value,
                        })
                      }
                      placeholder="例: very-disappointed"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <Label
                      htmlFor={`${idPrefix}-choice-${choice.key}-label`}
                      className="text-xs text-muted-foreground"
                    >
                      ラベル
                    </Label>
                    <Input
                      id={`${idPrefix}-choice-${choice.key}-label`}
                      value={choice.label}
                      disabled={disabled}
                      maxLength={CHOICE_LABEL_MAX_LENGTH}
                      onChange={(event) =>
                        updateChoice(question.key, choice.key, {
                          label: event.target.value,
                        })
                      }
                      placeholder="例: とても残念"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => removeChoice(question.key, choice.key)}
                    aria-label={`設問 ${index + 1} の選択肢 ${choiceIndex + 1} を削除`}
                  >
                    <HugeiconsIcon icon={Delete02Icon} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
