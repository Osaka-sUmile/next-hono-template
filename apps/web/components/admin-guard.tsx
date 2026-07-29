"use client"

import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { AuthGuard } from "@/components/auth-guard"
import { authClient } from "@/lib/auth-client"

/**
 * 管理エリア用のクライアントサイドガード。
 *
 * `AuthGuard` を内側で再利用して未認証は `/login` へリダイレクトし、
 * 認証済みでも role が admin でなければ 403 パネルを表示する。
 * role は better-auth セッションの additionalField なので API 呼び出しは不要。
 *
 * これは UX のためのガードであり、実際のアクセス制御は API 側の
 * `requireAdmin` ミドルウェアが行う(cookie が API オリジンにあるため
 * Next の middleware / SSR では判定できず、クライアント専用になる)。
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AdminRoleCheck>{children}</AdminRoleCheck>
    </AuthGuard>
  )
}

function AdminRoleCheck({ children }: { children: React.ReactNode }) {
  // AuthGuard が children を描画する時点でセッションは存在する
  const { data: session } = authClient.useSession()

  if (session?.user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <h1 className="text-2xl font-semibold">アクセス権限がありません</h1>
          <p className="text-sm text-muted-foreground">
            このページは管理者のみ閲覧できます。管理者権限が必要な場合は、
            管理者にお問い合わせください。
          </p>
          <Button asChild>
            <Link href="/dashboard">ダッシュボードへ戻る</Link>
          </Button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
