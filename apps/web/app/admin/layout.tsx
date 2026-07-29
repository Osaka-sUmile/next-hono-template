import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"
import { AdminGuard } from "@/components/admin-guard"
import { AdminHeader } from "@/components/admin-header"
import { AdminSidebar } from "@/components/admin-sidebar"

/**
 * 管理エリアのレイアウト。
 * `AdminGuard`(内部で `AuthGuard` を再利用)の内側にサイドバーとヘッダーを置き、
 * 未認証・非 admin にはシェル自体を見せない。
 * 管理ページを増やす場合はこの配下(`app/admin/**`)に追加する。
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminGuard>
      <SidebarProvider>
        <AdminSidebar />
        <SidebarInset>
          <AdminHeader />
          <main className="flex-1 p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </AdminGuard>
  )
}
