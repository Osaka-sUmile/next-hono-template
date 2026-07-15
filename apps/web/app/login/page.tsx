"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { AppleIcon, GoogleIcon } from "@hugeicons/core-free-icons";
import { Button } from "@workspace/ui/components/button";
import { authClient } from "@/lib/auth-client";

type Step = "request" | "verify";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
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
      setError("コードが正しくないか、有効期限切れです。未登録のメールアドレスの可能性もあります。");
      return;
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
      errorCallbackURL: `${window.location.origin}/login`,
    });
    if (error) {
      setLoading(false);
      setError("ログインに失敗しました。しばらく経ってから再試行してください。");
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
              {loading ? "処理中..." : "ログイン"}
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
          <h1 className="text-2xl font-bold">ログイン</h1>
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
            Google でログイン
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={loading}
            onClick={() => handleSocial("apple")}
          >
            <HugeiconsIcon icon={AppleIcon} />
            Apple でログイン
          </Button>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          アカウントをお持ちでない方は{" "}
          <Link href="/signup" className="text-primary underline underline-offset-4">
            新規登録
          </Link>
        </p>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/forgot-password" className="text-primary underline underline-offset-4">
            パスワードをお忘れですか？
          </Link>
        </p>
      </div>
    </div>
  );
}
