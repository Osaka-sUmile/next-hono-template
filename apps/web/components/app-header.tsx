"use client"

import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { Menu01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import { AccountMenu } from "@/components/account-menu"
import { authClient } from "@/lib/auth-client"

/**
 * 保護エリア共通のヘッダー。
 * 左にハンバーガー(ナビドロワー)、右にアカウントメニュー(表示名/メール変更/外観/ログアウト)。
 * テンプレートなのでナビ項目は最小限にとどめ、利用者が追加しやすい構成にしている。
 */
export function AppHeader() {
  const { data: session } = authClient.useSession()
  const isAdmin = session?.user.role === "admin"

  return (
    <header className="flex h-14 items-center justify-between border-b px-4">
      <div className="flex items-center gap-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="メニュー">
              <HugeiconsIcon icon={Menu01Icon} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>メニュー</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-4">
              <Link
                href="/dashboard"
                className="rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                ダッシュボード
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  管理画面
                </Link>
              )}
              {/* テンプレ利用者向け: ここにナビ項目を追加してください */}
            </nav>
          </SheetContent>
        </Sheet>
        <Link href="/dashboard" className="font-semibold">
          App Template
        </Link>
      </div>

      <AccountMenu />
    </header>
  )
}
