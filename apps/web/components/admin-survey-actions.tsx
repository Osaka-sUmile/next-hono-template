"use client"

import { useState } from "react"
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
import { ApiError, apiClient } from "@/lib/api-client"
import { ExpectedError, reportError } from "@/lib/report-error"

const SLUG_MAX_LENGTH = 64
const TITLE_MAX_LENGTH = 200
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

type SurveyListItem = {
  id: string
  slug: string
  title: string
  isActive: boolean
  submissionCount: number
}

function getErrorCode(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined
  const code = (body as { code?: unknown }).code
  return typeof code === "string" ? code : undefined
}

function duplicateSlug(slug: string): string {
  return `${slug.slice(0, SLUG_MAX_LENGTH - 5).replace(/-+$/, "")}-copy`
}

function buildDuplicateTitle(title: string): string {
  return `${title} のコピー`.slice(0, TITLE_MAX_LENGTH)
}

/**
 * 一覧の各アンケートに対する複製・削除操作。
 */
export function AdminSurveyActions({
  survey,
  onChanged,
}: {
  survey: SurveyListItem
  onChanged: () => void
}) {
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  const [duplicateTitle, setDuplicateTitle] = useState("")
  const [duplicateSlugValue, setDuplicateSlugValue] = useState("")
  const [duplicating, setDuplicating] = useState(false)
  const [duplicateError, setDuplicateError] = useState<string | null>(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const canDelete = !survey.isActive && survey.submissionCount === 0
  const deleteDisabledReason = survey.isActive
    ? "公開中のアンケートは削除できません"
    : survey.submissionCount > 0
      ? "回答済みのアンケートは削除できません"
      : undefined

  function handleDuplicateOpenChange(nextOpen: boolean) {
    if (!nextOpen && duplicating) return
    setDuplicateOpen(nextOpen)
    if (nextOpen) {
      setDuplicateTitle(buildDuplicateTitle(survey.title))
      setDuplicateSlugValue(duplicateSlug(survey.slug))
      setDuplicateError(null)
    }
  }

  function handleDeleteOpenChange(nextOpen: boolean) {
    if (!nextOpen && deleting) return
    setDeleteOpen(nextOpen)
    if (nextOpen) setDeleteError(null)
  }

  function preventDismissWhilePending(event: Event) {
    if (duplicating || deleting) event.preventDefault()
  }

  async function handleDuplicate(event: React.FormEvent) {
    event.preventDefault()
    const title = duplicateTitle.trim()
    const slug = duplicateSlugValue.trim()
    if (title === "") {
      setDuplicateError("タイトルを入力してください。")
      return
    }
    if (!SLUG_REGEX.test(slug)) {
      setDuplicateError(
        "slug は小文字英数字をハイフンで区切った形式で入力してください。"
      )
      return
    }

    setDuplicateError(null)
    setDuplicating(true)
    try {
      await apiClient.post(
        "/api/v1/admin/feedback/surveys/{surveyId}/duplicate",
        {
          params: { path: { surveyId: survey.id } },
          body: { title, slug },
        }
      )
      setDuplicateOpen(false)
      onChanged()
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.status === 400 || err.status === 404 || err.status === 409)
      ) {
        reportError(new ExpectedError(err.message, { cause: err }))
      } else {
        reportError(err)
      }
      if (
        err instanceof ApiError &&
        getErrorCode(err.body) === "FEEDBACK_SURVEY_SLUG_CONFLICT"
      ) {
        setDuplicateError(
          "この slug は既に使われています。別の slug を指定してください。"
        )
      } else if (err instanceof ApiError && err.status === 400) {
        setDuplicateError("入力内容に誤りがあります。")
      } else if (err instanceof ApiError && err.status === 404) {
        setDuplicateError("複製元のアンケートが見つかりません。")
      } else {
        setDuplicateError("アンケートの複製に失敗しました。")
      }
    } finally {
      setDuplicating(false)
    }
  }

  async function handleDelete() {
    setDeleteError(null)
    setDeleting(true)
    try {
      await apiClient.delete("/api/v1/admin/feedback/surveys/{surveyId}", {
        params: { path: { surveyId: survey.id } },
      })
      setDeleteOpen(false)
      onChanged()
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.status === 404 || err.status === 409)
      ) {
        reportError(new ExpectedError(err.message, { cause: err }))
      } else {
        reportError(err)
      }
      const code = err instanceof ApiError ? getErrorCode(err.body) : undefined
      if (code === "FEEDBACK_SURVEY_MUST_BE_INACTIVE") {
        setDeleteError("公開中のアンケートは削除できません。")
      } else if (code === "FEEDBACK_SURVEY_HAS_SUBMISSIONS") {
        setDeleteError("回答済みのアンケートは削除できません。")
      } else if (err instanceof ApiError && err.status === 404) {
        // 別管理者が先に削除した場合も一覧を最新化できるようにする。
        setDeleteOpen(false)
        onChanged()
      } else {
        setDeleteError("アンケートの削除に失敗しました。")
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Dialog open={duplicateOpen} onOpenChange={handleDuplicateOpenChange}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            複製
          </Button>
        </DialogTrigger>
        <DialogContent
          showCloseButton={!duplicating}
          onInteractOutside={preventDismissWhilePending}
          onEscapeKeyDown={preventDismissWhilePending}
        >
          <DialogHeader>
            <DialogTitle>アンケートを複製</DialogTitle>
            <DialogDescription>
              設問と選択肢をコピーして、非公開の新しいアンケートを作成します。回答はコピーされません。
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleDuplicate}
            noValidate
            className="flex flex-col gap-5"
          >
            <fieldset
              disabled={duplicating}
              className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0 disabled:opacity-70"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor={`duplicate-title-${survey.id}`}>
                  新しいタイトル
                </Label>
                <Input
                  id={`duplicate-title-${survey.id}`}
                  value={duplicateTitle}
                  maxLength={TITLE_MAX_LENGTH}
                  onChange={(event) => setDuplicateTitle(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`duplicate-slug-${survey.id}`}>
                  新しい slug
                </Label>
                <Input
                  id={`duplicate-slug-${survey.id}`}
                  value={duplicateSlugValue}
                  maxLength={SLUG_MAX_LENGTH}
                  onChange={(event) =>
                    setDuplicateSlugValue(event.target.value)
                  }
                />
              </div>
            </fieldset>
            {duplicateError && (
              <p role="alert" className="text-sm text-destructive">
                {duplicateError}
              </p>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={duplicating}>
                  キャンセル
                </Button>
              </DialogClose>
              <Button type="submit" disabled={duplicating}>
                {duplicating ? "複製中..." : "複製する"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={handleDeleteOpenChange}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={!canDelete}
            title={deleteDisabledReason}
            aria-label={`${survey.title} を削除`}
          >
            削除
          </Button>
        </DialogTrigger>
        <DialogContent
          showCloseButton={!deleting}
          onInteractOutside={preventDismissWhilePending}
          onEscapeKeyDown={preventDismissWhilePending}
        >
          <DialogHeader>
            <DialogTitle>アンケートを削除</DialogTitle>
            <DialogDescription>
              「{survey.title}」を完全に削除します。この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={deleting}>
                キャンセル
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? "削除中..." : "完全に削除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
