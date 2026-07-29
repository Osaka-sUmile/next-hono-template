import { AppHeader } from "@/components/app-header"
import { AuthGuard } from "@/components/auth-guard"

/**
 * 保護エリアのレイアウト。
 * `AuthGuard` の内側にヘッダーを置くことで、未認証時はヘッダー(ログアウト等)を見せない。
 * 保護ページを増やす場合はこの配下(`app/dashboard/**`)に追加する。
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </AuthGuard>
  )
}
