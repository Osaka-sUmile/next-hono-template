"use client"

import { useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { apiClient, ApiError } from "@/lib/api-client"
import { reportError } from "@/lib/report-error"

const ROLES = [
  { value: "user", label: "一般" },
  { value: "admin", label: "管理者" },
] as const

type Role = (typeof ROLES)[number]["value"]

type AdminUserRoleSelectProps = {
  userId: string
  role: Role
  /** アクセシブルネーム用。「<email> のロール」の形にする */
  userEmail: string
  /**
   * 操作者自身の行では true にする。サーバ側の CANNOT_CHANGE_OWN_ROLE ガードの
   * ミラーであり、自己降格によるロックアウトを UI からも防ぐ。
   */
  disabled?: boolean
  /** 変更成功後に呼ばれる。呼び出し側は一覧を reload する */
  onChanged: () => void
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const code =
      typeof error.body === "object" &&
      error.body !== null &&
      "code" in error.body
        ? error.body.code
        : undefined
    if (code === "CANNOT_CHANGE_OWN_ROLE")
      return "自分自身のロールは変更できません。"
    if (error.status === 404) return "対象のユーザーが見つかりませんでした。"
  }
  return "ロールの変更に失敗しました。"
}

/**
 * ユーザー一覧の行内でロールを変更する Select。
 * `PATCH /api/v1/admin/users/{userId}/role` を呼び、成功時は `onChanged` で
 * 一覧の再取得を促す(楽観更新はしない)。失敗時はインラインにエラーを表示する。
 */
export function AdminUserRoleSelect({
  userId,
  role,
  userEmail,
  disabled = false,
  onChanged,
}: AdminUserRoleSelectProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleValueChange(value: string) {
    // ROLES 由来の値しか来ないが、radix の onValueChange は string なので narrow する
    const nextRole = ROLES.find((r) => r.value === value)?.value
    if (nextRole === undefined || nextRole === role) return

    setIsSaving(true)
    setErrorMessage(null)
    try {
      await apiClient.patch("/api/v1/admin/users/{userId}/role", {
        params: { path: { userId } },
        body: { role: nextRole },
      })
      onChanged()
    } catch (error) {
      // 自己変更は UI で disable 済みのため、ここに来る失敗は想定外として送る
      reportError(error)
      setErrorMessage(resolveErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Select
        value={role}
        onValueChange={handleValueChange}
        disabled={disabled || isSaving}
      >
        <SelectTrigger aria-label={`${userEmail} のロール`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {errorMessage !== null && (
        <p role="alert" className="text-xs text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
