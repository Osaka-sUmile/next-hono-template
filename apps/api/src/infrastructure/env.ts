import { z } from "zod"

const originUrlSchema = z
  .url()
  .refine((value) => {
    const u = new URL(value)
    return u.pathname === "/" && !u.search && !u.hash
  }, "must be origin URL (no path/query/hash)")
  .transform((value) => new URL(value).origin)

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  // Zod v4 defaults short-circuit transforms; keep this default as a canonical origin.
  API_BASE_URL: originUrlSchema.default("http://localhost:8080"),
  WEB_BASE_URL: originUrlSchema.default("http://localhost:3001"),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.email(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  APPLE_CLIENT_ID: z.string().min(1),
  APPLE_CLIENT_SECRET: z.string().min(1),
  // Sentry DSN. 未設定ならエラー監視は無効（ローカル開発などでノイズを出さない）。
  SENTRY_DSN: z.url().optional(),
  // Sentry の environment タグ。preview / production はどちらも NODE_ENV=production の
  // ため、環境の識別にはこちらを使う（未設定なら NODE_ENV にフォールバック）。
  // 空文字は設定ミスとして起動時に弾く（SENTRY_DSN の url 検証と同じ fail-fast 方針）。
  SENTRY_ENVIRONMENT: z.string().trim().min(1).optional(),
  // Cloudflare Turnstile の secret key。emailOTP 送信系エンドポイントの captcha 検証に必須。
  TURNSTILE_SECRET_KEY: z.string().min(1),
})

export type Env = z.infer<typeof envSchema>

/**
 * Cloudflare Workers から渡される検証前の生の bindings。
 * `parseEnv` を通すまでは値の型・存在は保証されないため、
 * 検証済みの `Env` とは区別して扱う。
 */
export type WorkerBindings = Record<string, unknown>

/** Cloudflare Workers の Rate Limiting binding（wrangler.jsonc の ratelimits で定義）。 */
export type WorkerRateLimitBindings = {
  AUTH_RATE_LIMITER?: RateLimit
  FEEDBACK_SUBMIT_RATE_LIMITER?: RateLimit
}

/**
 * Cloudflare Workers の fetch handler が受け取る env オブジェクトを検証する。
 * Node の process.env と異なり isolate ごとに注入されるため、
 * モジュールレベルの singleton は持たず、呼び出し側で都度 parse する。
 */
export function parseEnv(source: WorkerBindings): Env {
  return envSchema.parse(source)
}
