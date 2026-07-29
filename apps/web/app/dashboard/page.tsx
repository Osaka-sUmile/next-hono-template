"use client"

import { authClient } from "@/lib/auth-client"
import { DisplayNameForm } from "@/components/display-name-form"

/**
 * 認証ガード付き保護ルートの実装例。
 * `AuthGuard`(dashboard/layout.tsx)を通過済みなのでセッションは存在するが、
 * 型の都合上 null チェックは残す。
 */
export default function DashboardPage() {
  const { data: session } = authClient.useSession()

  if (!session) {
    return null
  }

  const { user } = session

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <p className="text-sm text-muted-foreground">
          ログイン中のユーザー情報です。
        </p>
      </div>
      <dl className="divide-y rounded-lg border">
        <div className="flex justify-between gap-4 px-4 py-3">
          <dt className="text-sm text-muted-foreground">表示名</dt>
          <dd className="text-sm font-medium">{user.displayName ?? "-"}</dd>
        </div>
        <div className="flex justify-between gap-4 px-4 py-3">
          <dt className="text-sm text-muted-foreground">メールアドレス</dt>
          <dd className="text-sm font-medium">{user.email}</dd>
        </div>
        <div className="flex justify-between gap-4 px-4 py-3">
          <dt className="text-sm text-muted-foreground">ロール</dt>
          <dd className="text-sm font-medium">{user.role}</dd>
        </div>
      </dl>
      <div className="space-y-3 rounded-lg border p-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">表示名を変更</h2>
          <p className="text-sm text-muted-foreground">
            PATCH /api/v1/me を呼び出す Command 系の実装例です。
          </p>
        </div>
        <DisplayNameForm initialDisplayName={user.displayName ?? null} />
      </div>
    </div>
  )
}
