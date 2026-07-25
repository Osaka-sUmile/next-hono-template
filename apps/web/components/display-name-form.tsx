"use client";

import { useState } from "react";
import { Button } from "@workspace/ui/components/button";
import { ApiError, apiClient } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { ExpectedError, reportError } from "@/lib/report-error";

const DISPLAY_NAME_MAX_LENGTH = 100;

/**
 * 表示名を更新するフォーム（Command 系 API 呼び出しの実装見本）。
 *
 * better-auth のプラグイン経由ではなく、自前の REST エンドポイント `PATCH /api/v1/me` を
 * 呼ぶ例。fetch を直接書かず `lib/api-client.ts` を経由する（Cookie セッション認証に必要な
 * `credentials: "include"` は api-client が一元的に付与する）。
 */
export function DisplayNameForm({ initialDisplayName }: { initialDisplayName: string | null }) {
  const { refetch } = authClient.useSession();
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);
    try {
      const trimmed = displayName.trim();
      // 空文字はサーバ側で null（表示名なし）に正規化される。
      await apiClient.patch("/api/v1/me", { displayName: trimmed === "" ? null : trimmed });
      // 更新自体は成功済み。ここで成功を確定させ、セッション再取得の失敗を
      // 「更新失敗」として扱わない（refetch 失敗は別途 reportError するのみ）。
      setSaved(true);
      try {
        // better-auth セッションの user.displayName を最新化して UI に反映する。
        await refetch();
      } catch (refetchError) {
        reportError(refetchError);
      }
    } catch (error) {
      // ユーザー操作で当然起きうる 4xx（入力不正・未ログイン）は想定内として Sentry 送信を抑制する。
      // 何を想定内とみなすかは api-client ではなく呼び出し側が決める（fail-loud 原則）。
      if (error instanceof ApiError && (error.status === 400 || error.status === 401)) {
        reportError(new ExpectedError(error.message));
      } else {
        reportError(error);
      }
      setError("表示名の更新に失敗しました。ログイン済みか確認してください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="displayName" className="text-sm font-medium">
          表示名
        </label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          onChange={(e) => {
            setDisplayName(e.target.value);
            setSaved(false);
          }}
          placeholder="表示名を入力（空にすると未設定になります）"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {saved && <p className="text-sm text-muted-foreground">保存しました。</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "保存中..." : "表示名を保存"}
      </Button>
    </form>
  );
}
