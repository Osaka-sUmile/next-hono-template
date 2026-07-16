"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { HugeiconsIcon } from "@hugeicons/react";
import { Logout01Icon, Menu01Icon, UserCircleIcon } from "@hugeicons/core-free-icons";
import { Button } from "@workspace/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet";
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
} from "@workspace/ui/components/dropdown-menu";
import { authClient } from "@/lib/auth-client";

/**
 * 保護エリア共通のヘッダー。
 * 左にハンバーガー(ナビドロワー)、右にアカウントメニュー(表示名/メール変更/外観/ログアウト)。
 * テンプレートなのでナビ項目は最小限にとどめ、利用者が追加しやすい構成にしている。
 */
export function AppHeader() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const { data: session } = authClient.useSession();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setError(null);
    setLoading(true);
    const { error } = await authClient.signOut();
    setLoading(false);
    if (error) {
      setError("ログアウトに失敗しました。");
      return;
    }
    router.replace("/login");
  }

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
              {/* テンプレ利用者向け: ここにナビ項目を追加してください */}
            </nav>
          </SheetContent>
        </Sheet>
        <Link href="/dashboard" className="font-semibold">
          App Template
        </Link>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="アカウントメニュー">
            <HugeiconsIcon icon={UserCircleIcon} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <p className="truncate">{session?.user.displayName ?? "ユーザー"}</p>
            <p className="text-muted-foreground truncate text-xs font-normal">
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
              <DropdownMenuItem onClick={() => setTheme("light")}>ライト</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>ダーク</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>システム</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={loading} onClick={handleSignOut}>
            <HugeiconsIcon icon={Logout01Icon} />
            ログアウト
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {error && (
        <p role="alert" className="text-destructive fixed right-4 bottom-4 text-sm">
          {error}
        </p>
      )}
    </header>
  );
}
