"use client";

import { useState } from "react";
import { Button } from "@workspace/ui/components/button";
import { apiBaseUrl, authClient } from "@/lib/auth-client";
import { ExpectedError, reportError } from "@/lib/report-error";

const DISPLAY_NAME_MAX_LENGTH = 100;

/**
 * 表示名を更新するフォーム（Command 系 API 呼び出しの実装見本）。
 *
 * better-auth のプラグイン経由ではなく、自前の REST エンドポイント `PATCH /api/v1/me` を
 * 直接呼ぶ例。認証は Cookie セッションで行うため `credentials: "include"` が必須。
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
      const res = await fetch(`${apiBaseUrl}/api/v1/me`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        // 空文字はサーバ側で null（表示名なし）に正規化される。
        body: JSON.stringify({ displayName: trimmed === "" ? null : trimmed }),
      });
      if (!res.ok) {
        // ユーザー操作で当然起きうる 4xx（未ログイン等）は想定内として Sentry 送信を抑制する。
        if (res.status === 400 || res.status === 401) {
          throw new ExpectedError(`update failed with status ${res.status}`);
        }
        throw new Error(`update failed with status ${res.status}`);
      }
      // better-auth セッションの user.displayName を最新化して UI に反映する。
      await refetch();
      setSaved(true);
    } catch (error) {
      reportError(error);
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
