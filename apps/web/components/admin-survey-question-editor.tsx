"use client"

import { useState } from "react"
import { Edit02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
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
import {
  AdminSurveyQuestionFields,
  createQuestionDrafts,
  serializeQuestions,
  type QuestionDraft,
  validateQuestions,
} from "@/components/admin-survey-question-fields"
import { useApiResource } from "@/hooks/use-api-resource"
import { ApiError, apiClient } from "@/lib/api-client"
import { ExpectedError, reportError } from "@/lib/report-error"

function getErrorCode(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined
  const code = (body as { code?: unknown }).code
  return typeof code === "string" ? code : undefined
}

type AdminSurveyQuestionEditorProps = {
  surveyId: string
  onSaved: () => void
}

/**
 * 非公開・回答 0 件のアンケートに対し、設問セットを一括置換する。
 */
export function AdminSurveyQuestionEditor({
  surveyId,
  onSaved,
}: AdminSurveyQuestionEditorProps) {
  const {
    data: survey,
    error: loadError,
    isLoading,
    reload,
  } = useApiResource(() =>
    apiClient.get("/api/v1/admin/feedback/surveys/{surveyId}", {
      params: { path: { surveyId } },
    })
  )
  const [open, setOpen] = useState(false)
  const [questions, setQuestions] = useState<QuestionDraft[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && submitting) return
    setOpen(nextOpen)
    if (nextOpen && survey) {
      setQuestions(createQuestionDrafts(survey.questions))
      setError(null)
    }
  }

  function preventDismissWhileSubmitting(event: Event) {
    if (submitting) event.preventDefault()
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const validationError = validateQuestions(questions)
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setSubmitting(true)
    try {
      await apiClient.patch(
        "/api/v1/admin/feedback/surveys/{surveyId}/questions",
        {
          params: { path: { surveyId } },
          body: { questions: serializeQuestions(questions) },
        }
      )
      setOpen(false)
      reload()
      onSaved()
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.status === 400 || err.status === 404 || err.status === 409)
      ) {
        reportError(new ExpectedError(err.message, { cause: err }))
      } else {
        reportError(err)
      }

      const code = err instanceof ApiError ? getErrorCode(err.body) : undefined
      if (code === "FEEDBACK_SURVEY_MUST_BE_INACTIVE") {
        setError(
          "公開中のアンケートは編集できません。先に一覧画面で無効化してください。"
        )
      } else if (code === "FEEDBACK_SURVEY_HAS_SUBMISSIONS") {
        setError(
          "回答済みのアンケートは編集できません。複製して新しい下書きを作成してください。"
        )
      } else if (err instanceof ApiError && err.status === 400) {
        setError("入力内容に誤りがあります。各設問を確認してください。")
      } else if (err instanceof ApiError && err.status === 404) {
        setError("アンケートが見つかりません。")
      } else {
        setError("設問の更新に失敗しました。")
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <Button variant="outline" disabled>
        設問を読み込み中...
      </Button>
    )
  }

  if (loadError || !survey) {
    return (
      <div className="flex items-center gap-3">
        <p role="alert" className="text-sm text-destructive">
          設問の取得に失敗しました。
        </p>
        <Button variant="outline" size="sm" onClick={reload}>
          再読み込み
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button variant="outline" disabled={survey.isActive}>
            <HugeiconsIcon icon={Edit02Icon} />
            設問を編集
          </Button>
        </DialogTrigger>
        <DialogContent
          className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"
          showCloseButton={!submitting}
          onInteractOutside={preventDismissWhileSubmitting}
          onEscapeKeyDown={preventDismissWhileSubmitting}
        >
          <DialogHeader>
            <DialogTitle>設問を編集</DialogTitle>
            <DialogDescription>
              保存すると現在の設問をすべて置き換えます。設問と選択肢のIDも新しくなります。
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleSubmit}
            noValidate
            className="flex flex-col gap-6"
          >
            <fieldset
              disabled={submitting}
              className="m-0 min-w-0 border-0 p-0 disabled:opacity-70"
            >
              <AdminSurveyQuestionFields
                idPrefix="edit-survey"
                questions={questions}
                onChange={setQuestions}
                disabled={submitting}
                emptyMessage="設問はありません。公開するには1問以上追加してください。"
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
                {submitting ? "保存中..." : "設問を保存"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {survey.isActive && (
        <p className="text-sm text-muted-foreground">
          公開中のため編集できません。編集するには一覧画面で無効化してください。
        </p>
      )}
    </div>
  )
}
