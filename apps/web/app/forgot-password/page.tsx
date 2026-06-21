"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@workspace/ui/components/button";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authClient.emailOtp.requestPasswordReset({ email });
      setSubmitted(true);
    } catch {
      setError("送信に失敗しました。しばらく経ってから再試行してください。");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-2xl font-bold">メールを送信しました</h1>
        <p className="text-muted-foreground text-center max-w-sm">
          {email} にパスワードリセットコードを送信しました。メールを確認してください。
        </p>
        <Link href="/reset-password" className="text-primary underline underline-offset-4">
          リセットコードを入力する
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <div className="w-full max-w-sm space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">パスワードをお忘れですか？</h1>
          <p className="text-muted-foreground text-sm">
            登録済みのメールアドレスにリセットコードを送信します。
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "送信中..." : "リセットコードを送信"}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/" className="text-primary underline underline-offset-4">
            トップへ戻る
          </Link>
        </p>
      </div>
    </div>
  );
}
