"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { AppleIcon, GoogleIcon } from "@hugeicons/core-free-icons";
import { Button } from "@workspace/ui/components/button";
import { authClient } from "@/lib/auth-client";
import { reportError } from "@/lib/report-error";

type Step = "request" | "verify";

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });
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
    const { error } = await authClient.signIn.emailOtp({ email, otp });
    if (error) {
      setLoading(false);
      setError("コードが正しくありません。または有効期限が切れています。");
      return;
    }
    if (displayName) {
      // サインイン自体は成功しているため、表示名の保存失敗で登録フローを止めない
      const { error: updateError } = await authClient.updateUser({ displayName });
      if (updateError) {
        reportError(new Error(`Failed to save displayName after signup: ${updateError.message}`));
      }
    }
    router.replace("/");
  }

  async function handleSocial(provider: "google" | "apple") {
    setError(null);
    setLoading(true);
    // callbackURL は API オリジン基準で解決されるため、web 側の絶対 URL を渡す必要がある
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: `${window.location.origin}/`,
      errorCallbackURL: `${window.location.origin}/signup`,
    });
    if (error) {
      setLoading(false);
      setError("登録に失敗しました。しばらく経ってから再試行してください。");
    }
  }

  if (step === "verify") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
        <div className="w-full max-w-sm space-y-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">コードを入力</h1>
            <p className="text-muted-foreground text-sm">
              {email} に送信したコードを入力してください。
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
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "処理中..." : "登録する"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            コードを受け取っていない場合は{" "}
            <button
              type="button"
              onClick={() => { setStep("request"); setOtp(""); setError(null); }}
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
          <h1 className="text-2xl font-bold">新規登録</h1>
          <p className="text-muted-foreground text-sm">
            メールアドレスに認証コードを送信します。
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
          <div className="space-y-1">
            <label htmlFor="displayName" className="text-sm font-medium">
              表示名（任意）
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="山田 太郎"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "送信中..." : "認証コードを送信"}
          </Button>
        </form>
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-muted-foreground text-xs">または</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={loading}
            onClick={() => handleSocial("google")}
          >
            <HugeiconsIcon icon={GoogleIcon} />
            Google で登録
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={loading}
            onClick={() => handleSocial("apple")}
          >
            <HugeiconsIcon icon={AppleIcon} />
            Apple で登録
          </Button>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          すでにアカウントをお持ちの方は{" "}
          <Link href="/login" className="text-primary underline underline-offset-4">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}
