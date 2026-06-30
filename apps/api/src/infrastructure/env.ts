import { z } from "zod";

const originUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const u = new URL(value);
    return u.pathname === "/" && !u.search && !u.hash;
  }, "must be origin URL (no path/query/hash)")
  .transform((value) => new URL(value).origin);

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  NODE_ENV: z.enum(["development", "test", "production"]),
  DATABASE_URL: z.string().min(1),
  OPENAPI_PATH: z.string().optional(),
  AUTH_SECRET: z.string().min(32),
  API_BASE_URL: originUrlSchema.default("http://localhost:8080"),
  WEB_BASE_URL: originUrlSchema.default("http://localhost:3001"),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().email(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  APPLE_CLIENT_ID: z.string().min(1),
  APPLE_CLIENT_SECRET: z.string().min(1),
  // Sentry DSN. 未設定ならエラー監視は無効（ローカル開発などでノイズを出さない）。
  SENTRY_DSN: z.string().url().optional(),
});

export const env = envSchema.parse(process.env);