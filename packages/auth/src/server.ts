import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import { Resend } from "resend";

// Avoid importing PrismaClient from @prisma/client directly.
// @prisma/client only exports PrismaClient after `prisma generate` is run,
// so a direct import would break builds that don't run prisma generate (e.g. apps/web).
// The actual PrismaClient is provided by apps/api at runtime via dependency injection.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClientInput = Record<string, any>;

interface AuthConfig {
  prisma: PrismaClientInput;
  secret: string;
  baseURL: string;
  resendApiKey: string;
  google: { clientId: string; clientSecret: string };
  apple: { clientId: string; clientSecret: string };
}

export function createAuth(config: AuthConfig) {
  const resendClient = new Resend(config.resendApiKey);

  return betterAuth({
    secret: config.secret,
    baseURL: config.baseURL,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    database: prismaAdapter(config.prisma as any, {
      provider: "postgresql",
    }),
    plugins: [
      emailOTP({
        async sendVerificationOTP({ email, otp }: { email: string; otp: string; type: string }) {
          const { error } = await resendClient.emails.send({
            from: "noreply@yomutan.app",
            to: email,
            subject: "Your verification code",
            text: `Your code is: ${otp}`,
          });
          if (error) throw new Error(`Failed to send OTP email: ${error.message}`);
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
