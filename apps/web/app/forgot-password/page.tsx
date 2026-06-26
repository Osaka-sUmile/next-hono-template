"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@workspace/ui/components/button";
import { authClient } from "@/lib/auth-client";

type Step = "request" | "verify" | "done";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await authClient.emailOtp.requestPasswordReset({ email });
    setLoading(false);
    if (error) {
      setError("送信に失敗しました。しばらく経ってから再試行してください。");
      return;
    }
    setStep("verify");
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await authClient.emailOtp.resetPassword({ email, otp, password });
    setLoading(false);
    if (error) {
      setError("コードが正しくありません。または有効期限が切れています。");
      return;
    }
    setStep("done");
  }

  if (step === "done") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-2xl font-bold">パスワードをリセットしました</h1>
        <p className="text-muted-foreground text-center max-w-sm">
          新しいパスワードでログインしてください。
        </p>
        <Link href="/" className="text-primary underline underline-offset-4">
          トップへ戻る
        </Link>
      </div>
    );
  }

  if (step === "verify") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
        <div className="w-full max-w-sm space-y-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">パスワードをリセット</h1>
            <p className="text-muted-foreground text-sm">
              {email} に送信したコードを入力してください。
            </p>
          </div>
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="otp" className="text-sm font-medium">
                リセットコード
              </label>
              <input
                id="otp"
                type="text"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="password" className="text-sm font-medium">
                新しいパスワード
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "処理中..." : "パスワードをリセット"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            コードを受け取っていない場合は{" "}
            <button
              type="button"
              onClick={() => { setStep("request"); setOtp(""); setPassword(""); setError(null); }}
              className="text-primary underline underline-offset-4"
            >
              再送信する
            </button>
          </p>
        </div>
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
        <form onSubmit={handleRequest} className="space-y-4">
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
