"use client"

import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { ApiError, apiClient } from "@/lib/api-client"
import { authClient } from "@/lib/auth-client"
import { ExpectedError, reportError } from "@/lib/report-error"

const DISPLAY_NAME_MAX_LENGTH = 100

/**
 * 表示名を更新するフォーム（Command 系 API 呼び出しの実装見本）。
 *
 * better-auth のプラグイン経由ではなく、自前の REST エンドポイント `PATCH /api/v1/me` を
 * 直接呼ぶ例。認証は Cookie セッションで行うため `credentials: "include"` が必須。
 */
export function DisplayNameForm({
  initialDisplayName,
}: {
  initialDisplayName: string | null
}) {
  const { refetch } = authClient.useSession()
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "")
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setLoading(true)
    try {
      const trimmed = displayName.trim()
      // 空文字はサーバ側で null（表示名なし）に正規化される。
      await apiClient.patch("/api/v1/me", {
        displayName: trimmed === "" ? null : trimmed,
      })
      // 更新自体は成功済み。ここで成功を確定させ、セッション再取得の失敗を
      // 「更新失敗」として扱わない（refetch 失敗は別途 reportError するのみ）。
      setSaved(true)
      try {
        // better-auth セッションの user.displayName を最新化して UI に反映する。
        await refetch()
      } catch (refetchError) {
        reportError(refetchError)
      }
    } catch (error) {
      // 4xx（未ログイン・入力不正）はユーザー操作で当然起きうるため Sentry 送信を抑制する。
      const expected =
        error instanceof ApiError &&
        (error.status === 400 || error.status === 401)
      reportError(expected ? new ExpectedError(error.message) : error)
      setError("表示名の更新に失敗しました。ログイン済みか確認してください。")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="displayName" className="text-sm font-medium">
          表示名
        </label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          onChange={(e) => {
            setDisplayName(e.target.value)
            setSaved(false)
          }}
          placeholder="表示名を入力（空にすると未設定になります）"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-muted-foreground">保存しました。</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "保存中..." : "表示名を保存"}
      </Button>
    </form>
  )
}
