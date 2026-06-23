"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@workspace/ui/components/button";
import { authClient } from "@/lib/auth-client";

type Step = "request" | "verify" | "done";

export default function ChangeEmailPage() {
  const [step, setStep] = useState<Step>("request");
  const [newEmail, setNewEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authClient.emailOtp.requestEmailChange({ newEmail });
      setStep("verify");
    } catch (error) {
      console.error("Failed to request email change:", error);
      setError("送信に失敗しました。ログイン済みか確認してください。");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authClient.emailOtp.changeEmail({ newEmail, otp });
      setStep("done");
    } catch (error) {
      console.error("Failed to change email:", error);
      setError("変更に失敗しました。コードが正しいか確認してください。");
    } finally {
      setLoading(false);
    }
  }

  if (step === "done") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-2xl font-bold">メールアドレスを変更しました</h1>
        <p className="text-muted-foreground text-center max-w-sm">
          新しいメールアドレス（{newEmail}）に変更されました。
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
            <h1 className="text-2xl font-bold">認証コードを入力</h1>
            <p className="text-muted-foreground text-sm">
              {newEmail} に送信したコードを入力してください。
            </p>
          </div>
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="otp" className="text-sm font-medium">
                認証コード
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
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "処理中..." : "メールアドレスを変更"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            <button
              type="button"
              onClick={() => { setStep("request"); setOtp(""); setError(null); }}
              className="text-primary underline underline-offset-4"
            >
              メールアドレスを再入力する
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
          <h1 className="text-2xl font-bold">メールアドレスを変更</h1>
          <p className="text-muted-foreground text-sm">
            新しいメールアドレスに確認コードを送信します。
          </p>
        </div>
        <form onSubmit={handleRequest} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="newEmail" className="text-sm font-medium">
              新しいメールアドレス
            </label>
            <input
              id="newEmail"
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="new@example.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "送信中..." : "確認コードを送信"}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/" className="text-primary underline underline-offset-4">
            キャンセル
          </Link>
        </p>
      </div>
    </div>
  );
}
