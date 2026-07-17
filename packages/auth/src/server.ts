import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";
import { Resend } from "resend";
import type { PrismaClient } from "@prisma/client";

// better-auth's prismaAdapter requires only user, session, account, and verification delegations.
// We use Pick to ensure strict type safety and avoid broad any typing.
// Avoid runtime import of PrismaClient: only the type is imported to prevent build issues
// when prisma generate hasn't run (e.g., in apps/web). The actual instance is injected at runtime.
type PrismaClientInput = Pick<PrismaClient, "user" | "session" | "account" | "verification">;

interface AuthConfig {
  prisma: PrismaClientInput;
  /**
   * テスト時に prismaAdapter の代わりに注入する DB アダプタ(better-auth の memoryAdapter 等)。
   * 本番コードでは未指定のままとし、常に prismaAdapter を使う。
   */
  database?: BetterAuthOptions["database"];
  secret: string;
  baseURL: string;
  /** web アプリのオリジン。「アカウント未登録」案内メール内の登録ページ URL に使う。 */
  webBaseURL: string;
  trustedOrigins: string[];
  resendApiKey: string;
  resendFromEmail: string;
  google: { clientId: string; clientSecret: string };
  apple: { clientId: string; clientSecret: string };
}

export function createAuth(config: AuthConfig) {
  const resendClient = new Resend(config.resendApiKey);

  // OTP 本体を送る（従来の挙動）。
  async function sendOtpEmail(email: string, otp: string, type: string) {
    const subject =
      type === "forget-password" ? "パスワードリセットコード" :
      type === "change-email"    ? "メールアドレス変更コード" :
                                   "認証コード";
    const body = `${subject}: ${otp}\n\nこのコードは5分間有効です。`;
    const { error } = await resendClient.emails.send({
      from: config.resendFromEmail,
      to: email,
      subject,
      text: body,
    });
    if (error) throw new Error(`Failed to send OTP email: ${error.message ?? JSON.stringify(error)}`);
  }

  // 未登録メールでのログイン試行に対し、OTP の代わりに登録導線を案内するメールを送る。
  // OTP を送らないことで自動アカウント作成を避けつつ、ユーザーには必ずフィードバックを届ける。
  async function sendNoAccountEmail(email: string) {
    const signupUrl = `${config.webBaseURL}/signup`;
    const subject = "アカウントが見つかりません";
    const body =
      `このメールアドレスのアカウントは登録されていません。\n\n` +
      `新規登録はこちら: ${signupUrl}\n\n` +
      `お心当たりがない場合はこのメールを無視してください。`;
    const { error } = await resendClient.emails.send({
      from: config.resendFromEmail,
      to: email,
      subject,
      text: body,
    });
    if (error) throw new Error(`Failed to send no-account email: ${error.message ?? JSON.stringify(error)}`);
  }

  return betterAuth({
    secret: config.secret,
    baseURL: config.baseURL,
    trustedOrigins: config.trustedOrigins,
    session: {
      expiresIn: 7 * 24 * 60 * 60, // 7 days
      updateAge: 24 * 60 * 60,     // refresh session every 24 hours
    },
    database:
      config.database ??
      prismaAdapter(config.prisma, {
        provider: "postgresql",
      }),
    hooks: {
      // emailOTP プラグインの sign-in は未登録メールを自動的に新規登録するため、
      // 明示的な登録意図 (body.signUp === true) がないリクエストでは未登録メールを拒否し、
      // ログイン(/login)と新規登録(/signup)の契約を分離する。
      // 未登録エラーは OTP 不一致と同じレスポンスにし、アカウント列挙を防ぐ。
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/email-otp") return;
        const body = ctx.body as { email?: unknown; signUp?: unknown } | undefined;
        if (body?.signUp === true) return;
        // email の形式検証はプラグイン本体の Zod スキーマに任せる
        if (typeof body?.email !== "string") return;
        const user = await ctx.context.internalAdapter.findUserByEmail(body.email.toLowerCase());
        if (!user) {
          throw new APIError("BAD_REQUEST", { message: "Invalid OTP", code: "INVALID_OTP" });
        }
      }),
    },
    plugins: [
      emailOTP({
        changeEmail: { enabled: true },
        async sendVerificationOTP({ email, otp, type }: { email: string; otp: string; type: string }, ctx) {
          // sign-in 系のみ、ログイン/新規登録の契約を分離する。
          // signup ページからの送信だけが x-signup-intent ヘッダを付与する。
          // ctx が無い場合は意図も登録状態も判定できないため分岐をスキップし OTP 送信に
          // フォールバックする（実ユーザーを止めない。未登録の作成防止は verify 時の before フックが担保）。
          if (type === "sign-in" && ctx) {
            const isSignUpIntent = ctx.getHeader("x-signup-intent") === "1";
            // email は send ルートで小文字化済み。verify 側フックと同じ内部アダプタで判定する。
            const isRegistered = !!(await ctx.context.internalAdapter.findUserByEmail(email));
            // 未登録 かつ 登録意図なし(=ログイン試行) → OTP を送らず登録導線を案内する。
            // レスポンスは success:true のまま変えない（アカウント列挙を防ぐため throw しない）。
            if (!isRegistered && !isSignUpIntent) {
              await sendNoAccountEmail(email);
              return;
            }
          }
          await sendOtpEmail(email, otp, type);
        },
      }),
    ],
    socialProviders: {
      google: {
        clientId: config.google.clientId,
        clientSecret: config.google.clientSecret,
      },
      apple: {
        clientId: config.apple.clientId,
        clientSecret: config.apple.clientSecret,
      },
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          defaultValue: "user",
          input: false,
        },
        displayName: {
          type: "string",
          required: false,
        },
      },
    },
  });
}

export type AuthInstance = ReturnType<typeof createAuth>;
export type Session = AuthInstance["$Infer"]["Session"]["session"];
export type User = AuthInstance["$Infer"]["Session"]["user"];

export { toNodeHandler, fromNodeHeaders } from "better-auth/node";
