"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

/**
 * クライアントサイドの認証ガード。
 *
 * 本番では web と API が別オリジンで動くため、セッション cookie は API ドメインにしか
 * 保存されず Next.js の middleware / SSR からは読めない。そのため保護は
 * クライアント側の `useSession()` に依存する。
 *
 * - 判定中(`isPending`)はローディングを表示し、未認証コンテンツのフラッシュを防ぐ。
 * - 未認証なら `/login` へリダイレクトし、リダイレクト完了までは何も描画しない。
 * - `isRefetching`(タブ復帰時などの再検証)では children を維持し、チラつきを避ける。
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/login");
    }
  }, [isPending, session, router]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">読み込み中...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return <>{children}</>;
}
