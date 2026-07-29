"use client"

import { useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
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
import { ApiError, apiClient } from "@/lib/api-client"
import { ExpectedError, reportError } from "@/lib/report-error"

/**
 * サーバ側 (apps/api/src/presentation/routes/feedback.route.ts) の入力上限のミラー。
 * ここでの制限は UX のためであり、真の検証は API 側の Zod スキーマが行う。
 */
const SLUG_MAX_LENGTH = 64
const TITLE_MAX_LENGTH = 200
const QUESTION_TEXT_MAX_LENGTH = 2000
const CHOICE_VALUE_MAX_LENGTH = 100
const CHOICE_LABEL_MAX_LENGTH = 200
const QUESTIONS_MAX_COUNT = 50
const CHOICES_MAX_COUNT = 20
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

type QuestionType = "single_choice" | "text"

type ChoiceDraft = {
  key: number
  value: string
  label: string
}

type QuestionDraft = {
  key: number
  type: QuestionType
  text: string
  required: boolean
  choices: ChoiceDraft[]
}

function getErrorCode(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined
  const code = (body as { code?: unknown }).code
  return typeof code === "string" ? code : undefined
}

/**
 * 送信前のクライアント側検証。サーバ側 Zod スキーマの制約をミラーし、
 * 400 を往復せずにその場で直せるようにする。最初に見つかった問題を返す。
 */
function validate(
  title: string,
  slug: string,
  isActive: boolean,
  questions: QuestionDraft[]
): string | null {
  if (title.trim() === "") return "タイトルを入力してください。"
  if (slug.trim() === "") return "slug を入力してください。"
  if (!SLUG_REGEX.test(slug.trim())) {
    return "slug は小文字英数字をハイフンで区切った形式で入力してください（例: pmf-2026）。"
  }
  if (isActive && questions.length === 0) {
    return "設問が 1 問もないアンケートは有効化できません。"
  }
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

/**
 * アンケート作成ダイアログ。`POST /api/v1/admin/feedback/surveys` を呼ぶ。
 *
 * react-hook-form は依存に無いため `useState` の手書きフォームで実装する。
 * 設問の並び順(sortOrder)は API が配列インデックスから導出するので送らない。
 */
export function AdminSurveyCreateForm({
  onCreated,
}: {
  onCreated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [isActive, setIsActive] = useState(false)
  const [questions, setQuestions] = useState<QuestionDraft[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // React の key 用に採番する連番。並び替えは無いのでこれで安定する。
  const nextKeyRef = useRef(0)
  function nextKey() {
    nextKeyRef.current += 1
    return nextKeyRef.current
  }

  function resetForm() {
    setTitle("")
    setSlug("")
    setIsActive(false)
    setQuestions([])
    setError(null)
  }

  function handleOpenChange(nextOpen: boolean) {
    // 送信中に閉じると、完了後の成功/失敗が別セッションのフォームへ誤って反映される。
    if (!nextOpen && submitting) return
    setOpen(nextOpen)
    if (nextOpen) resetForm()
  }

  function preventDismissWhileSubmitting(event: Event) {
    if (submitting) event.preventDefault()
  }

  function addQuestion() {
    setQuestions((prev) => [
      ...prev,
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
    setQuestions((prev) =>
      prev.map((q) => (q.key === key ? { ...q, ...patch } : q))
    )
  }

  function removeQuestion(key: number) {
    setQuestions((prev) => prev.filter((q) => q.key !== key))
  }

  function addChoice(questionKey: number) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.key === questionKey
          ? {
              ...q,
              choices: [...q.choices, { key: nextKey(), value: "", label: "" }],
            }
          : q
      )
    )
  }

  function updateChoice(
    questionKey: number,
    choiceKey: number,
    patch: Partial<ChoiceDraft>
  ) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.key === questionKey
          ? {
              ...q,
              choices: q.choices.map((c) =>
                c.key === choiceKey ? { ...c, ...patch } : c
              ),
            }
          : q
      )
    )
  }

  function removeChoice(questionKey: number, choiceKey: number) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.key === questionKey
          ? { ...q, choices: q.choices.filter((c) => c.key !== choiceKey) }
          : q
      )
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationError = validate(title, slug, isActive, questions)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await apiClient.post("/api/v1/admin/feedback/surveys", {
        body: {
          slug: slug.trim(),
          title: title.trim(),
          isActive,
          questions: questions.map((q) => ({
            type: q.type,
            text: q.text.trim(),
            required: q.required,
            // text 設問の選択肢はサーバが 400 で拒否するため送らない。
            choices:
              q.type === "single_choice"
                ? q.choices.map((c) => ({
                    value: c.value.trim(),
                    label: c.label.trim(),
                  }))
                : [],
          })),
        },
      })
      setOpen(false)
      onCreated()
    } catch (err) {
      // 400(入力不正)・409(slug 重複 / 公開不可)は管理者の操作で当然起きうる想定内。
      if (
        err instanceof ApiError &&
        (err.status === 400 || err.status === 409)
      ) {
        reportError(new ExpectedError(err.message, { cause: err }))
      } else {
        reportError(err)
      }
      const code = err instanceof ApiError ? getErrorCode(err.body) : undefined
      if (code === "FEEDBACK_SURVEY_SLUG_CONFLICT") {
        setError(
          "この slug は既に使われています。別の slug を指定してください。"
        )
      } else if (code === "FEEDBACK_SURVEY_NOT_PUBLISHABLE") {
        setError("設問が 1 問もないアンケートは有効化できません。")
      } else if (err instanceof ApiError && err.status === 400) {
        setError("入力内容に誤りがあります。各項目を確認してください。")
      } else {
        setError("アンケートの作成に失敗しました。")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <HugeiconsIcon icon={Add01Icon} />
          アンケートを作成
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"
        showCloseButton={!submitting}
        onInteractOutside={preventDismissWhileSubmitting}
        onEscapeKeyDown={preventDismissWhileSubmitting}
      >
        <DialogHeader>
          <DialogTitle>アンケートを作成</DialogTitle>
          <DialogDescription>
            タイトル・slug
            と設問を入力してください。有効化すると他のアンケートは自動で無効になります。
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-6"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="survey-title">タイトル</Label>
            <Input
              id="survey-title"
              value={title}
              maxLength={TITLE_MAX_LENGTH}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: PMF アンケート 2026"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="survey-slug">slug</Label>
            <Input
              id="survey-slug"
              value={slug}
              maxLength={SLUG_MAX_LENGTH}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="例: pmf-2026"
            />
            <p className="text-xs text-muted-foreground">
              小文字英数字をハイフンで区切った形式。公開 URL のキーになります。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="survey-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="survey-active">作成と同時に有効化する</Label>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">設問</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addQuestion}
                disabled={questions.length >= QUESTIONS_MAX_COUNT}
              >
                <HugeiconsIcon icon={Add01Icon} />
                設問を追加
              </Button>
            </div>
            {questions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                設問はまだありません。あとから追加することはできないため、有効化する前にここで追加してください。
              </p>
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
                    onClick={() => removeQuestion(question.key)}
                    aria-label={`設問 ${index + 1} を削除`}
                  >
                    <HugeiconsIcon icon={Delete02Icon} />
                  </Button>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`question-${question.key}-type`}>種別</Label>
                  <Select
                    value={question.type}
                    onValueChange={(value) =>
                      updateQuestion(question.key, {
                        type: value as QuestionType,
                      })
                    }
                  >
                    <SelectTrigger
                      id={`question-${question.key}-type`}
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
                  <Label htmlFor={`question-${question.key}-text`}>本文</Label>
                  <Textarea
                    id={`question-${question.key}-text`}
                    value={question.text}
                    maxLength={QUESTION_TEXT_MAX_LENGTH}
                    onChange={(e) =>
                      updateQuestion(question.key, { text: e.target.value })
                    }
                    placeholder="設問の本文を入力"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    id={`question-${question.key}-required`}
                    checked={question.required}
                    onCheckedChange={(checked) =>
                      updateQuestion(question.key, { required: checked })
                    }
                  />
                  <Label htmlFor={`question-${question.key}-required`}>
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
                        disabled={question.choices.length >= CHOICES_MAX_COUNT}
                      >
                        <HugeiconsIcon icon={Add01Icon} />
                        選択肢を追加
                      </Button>
                    </div>
                    {question.choices.map((choice, choiceIndex) => (
                      <div key={choice.key} className="flex items-end gap-2">
                        <div className="flex flex-1 flex-col gap-1">
                          <Label
                            htmlFor={`choice-${choice.key}-value`}
                            className="text-xs text-muted-foreground"
                          >
                            値
                          </Label>
                          <Input
                            id={`choice-${choice.key}-value`}
                            value={choice.value}
                            maxLength={CHOICE_VALUE_MAX_LENGTH}
                            onChange={(e) =>
                              updateChoice(question.key, choice.key, {
                                value: e.target.value,
                              })
                            }
                            placeholder="例: very-disappointed"
                          />
                        </div>
                        <div className="flex flex-1 flex-col gap-1">
                          <Label
                            htmlFor={`choice-${choice.key}-label`}
                            className="text-xs text-muted-foreground"
                          >
                            ラベル
                          </Label>
                          <Input
                            id={`choice-${choice.key}-label`}
                            value={choice.label}
                            maxLength={CHOICE_LABEL_MAX_LENGTH}
                            onChange={(e) =>
                              updateChoice(question.key, choice.key, {
                                label: e.target.value,
                              })
                            }
                            placeholder="例: とても残念"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
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

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={submitting}>
                キャンセル
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? "作成中..." : "作成"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
