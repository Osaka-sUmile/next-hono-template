import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
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
    plugins: [
      emailOTP({
        expiresIn: 10 * 60, // 10 minutes
        async sendVerificationOTP({ email, otp }: { email: string; otp: string }) {
          const { error } = await resendClient.emails.send({
            from: config.resendFromEmail,
            to: email,
            subject: "Your verification code",
            text: `Your code is: ${otp}`,
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
