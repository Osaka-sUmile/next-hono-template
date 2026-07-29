"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { HugeiconsIcon } from "@hugeicons/react"
import { Logout01Icon, UserCircleIcon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { authClient } from "@/lib/auth-client"
import { reportError } from "@/lib/report-error"

/**
 * アカウントメニュー(表示名/メール変更/外観/ログアウト)。
 * 一般エリアの `AppHeader` と管理エリアの `AdminHeader` の両方から使うため、
 * サインアウト・テーマ切り替えのロジックをここに一元化する。
 */
export function AccountMenu() {
  const router = useRouter()
  const { setTheme } = useTheme()
  const { data: session } = authClient.useSession()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setError(null)
    setLoading(true)
    try {
      // 戻り値の { error }(想定内エラー)は UI 通知のみ、
      // reject(ネットワーク断など想定外エラー)は reportError で Sentry へ送る。
      const { error } = await authClient.signOut()
      if (error) {
        setError("ログアウトに失敗しました。")
        return
      }
      router.replace("/login")
    } catch (err) {
      reportError(err)
      setError("ログアウトに失敗しました。")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="アカウントメニュー">
            <HugeiconsIcon icon={UserCircleIcon} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <p className="truncate">
              {session?.user.displayName ?? "ユーザー"}
            </p>
            <p className="truncate text-xs font-normal text-muted-foreground">
              {session?.user.email}
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/change-email">メールアドレス変更</Link>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>外観</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => setTheme("light")}>
                ライト
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                ダーク
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                システム
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={loading}
            onClick={handleSignOut}
          >
            <HugeiconsIcon icon={Logout01Icon} />
            ログアウト
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {error && (
        <p
          role="alert"
          className="fixed right-4 bottom-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </>
  )
}
