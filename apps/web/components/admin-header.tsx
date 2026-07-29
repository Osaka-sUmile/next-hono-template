"use client"

import { usePathname } from "next/navigation"
import { Separator } from "@workspace/ui/components/separator"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { AccountMenu } from "@/components/account-menu"

const PAGE_TITLES = [
  { prefix: "/admin/users", title: "ユーザー" },
  { prefix: "/admin/surveys", title: "アンケート" },
  { prefix: "/admin", title: "ダッシュボード" },
] as const

function resolveTitle(pathname: string): string {
  // 前方一致の特殊性が高い順に並べてある(/admin が最後)
  const matched = PAGE_TITLES.find(
    (entry) =>
      pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`)
  )
  return matched?.title ?? "管理画面"
}

/**
 * 管理エリア共通のヘッダー。
 * 左にサイドバートグルと現在ページのタイトル、右にアカウントメニュー。
 */
export function AdminHeader() {
  const pathname = usePathname()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-4" />
        <h1 className="text-sm font-medium">{resolveTitle(pathname)}</h1>
      </div>
      <AccountMenu />
    </header>
  )
}
