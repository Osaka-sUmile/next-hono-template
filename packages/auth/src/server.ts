import { betterAuth } from "better-auth";
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
  secret: string;
  baseURL: string;
  trustedOrigins: string[];
  resendApiKey: string;
  resendFromEmail: string;
  google: { clientId: string; clientSecret: string };
  apple: { clientId: string; clientSecret: string };
}

export function createAuth(config: AuthConfig) {
  const resendClient = new Resend(config.resendApiKey);

  return betterAuth({
    secret: config.secret,
    baseURL: config.baseURL,
    trustedOrigins: config.trustedOrigins,
    session: {
      expiresIn: 7 * 24 * 60 * 60, // 7 days
      updateAge: 24 * 60 * 60,     // refresh session every 24 hours
    },
    database: prismaAdapter(config.prisma, {
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
        async sendVerificationOTP({ email, otp, type }: { email: string; otp: string; type: string }) {
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
