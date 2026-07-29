"use client"

import { useState } from "react"
import { Switch } from "@workspace/ui/components/switch"
import { ApiError, apiClient } from "@/lib/api-client"
import { ExpectedError, reportError } from "@/lib/report-error"

/**
 * サーバのエラーボディ (`{ error, code }`) から code を安全に取り出す。
 * ボディの形は `unknown` なので、絞り込みは呼び出し側で行う方針 (lib/api-client.ts)。
 */
function getErrorCode(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined
  const code = (body as { code?: unknown }).code
  return typeof code === "string" ? code : undefined
}

/**
 * アンケートの有効/無効を切り替えるスイッチ。
 * `PATCH /api/v1/admin/feedback/surveys/{surveyId}` に `{ isActive }` を送る。
 *
 * 有効化はサーバ側で「同時にアクティブなのは 1 件」に正規化される
 * (他のアンケートが自動で無効化される) ため、成功時は自画面の楽観更新ではなく
 * `onChanged`(= 一覧の reload) で副作用込みの最新状態を取り直す。
 */
export function AdminSurveyActiveSwitch({
  surveyId,
  title,
  isActive,
  onChanged,
}: {
  surveyId: string
  title: string
  isActive: boolean
  onChanged: () => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleToggle(next: boolean) {
    setError(null)
    setPending(true)
    try {
      await apiClient.patch("/api/v1/admin/feedback/surveys/{surveyId}", {
        params: { path: { surveyId } },
        body: { isActive: next },
      })
      onChanged()
    } catch (err) {
      // 409(公開不可)・404(別の管理者による削除等)は管理操作で当然起きうる想定内。
      // それ以外は fail-loud でそのまま Sentry へ送る。
      if (
        err instanceof ApiError &&
        (err.status === 409 || err.status === 404)
      ) {
        reportError(new ExpectedError(err.message, { cause: err }))
      } else {
        reportError(err)
      }
      if (
        err instanceof ApiError &&
        getErrorCode(err.body) === "FEEDBACK_SURVEY_NOT_PUBLISHABLE"
      ) {
        setError("設問が 1 問もないアンケートは有効化できません。")
      } else {
        setError("有効状態の更新に失敗しました。")
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Switch
        checked={isActive}
        disabled={pending}
        onCheckedChange={handleToggle}
        aria-label={`${title} を${isActive ? "無効化" : "有効化"}`}
      />
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
