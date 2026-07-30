"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"
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
import { Switch } from "@workspace/ui/components/switch"
import {
  AdminSurveyQuestionFields,
  serializeQuestions,
  type QuestionDraft,
  validateQuestions,
} from "@/components/admin-survey-question-fields"
import { ApiError, apiClient } from "@/lib/api-client"
import { ExpectedError, reportError } from "@/lib/report-error"

/**
 * サーバ側 (apps/api/src/presentation/routes/feedback.route.ts) の入力上限のミラー。
 * ここでの制限は UX のためであり、真の検証は API 側の Zod スキーマが行う。
 */
const SLUG_MAX_LENGTH = 64
const TITLE_MAX_LENGTH = 200
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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
  return validateQuestions(questions)
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
          questions: serializeQuestions(questions),
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
          <fieldset
            disabled={submitting}
            className="m-0 flex min-w-0 flex-col gap-6 border-0 p-0 disabled:opacity-70"
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
                小文字英数字をハイフンで区切った形式。公開 URL
                のキーになります。
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="survey-active"
                checked={isActive}
                disabled={submitting}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="survey-active">作成と同時に有効化する</Label>
            </div>

            <AdminSurveyQuestionFields
              idPrefix="create-survey"
              questions={questions}
              onChange={setQuestions}
              disabled={submitting}
              emptyMessage="設問はまだありません。非公開で作成し、あとから追加することもできます。"
            />
          </fieldset>

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
