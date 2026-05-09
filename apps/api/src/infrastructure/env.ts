import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  OPENAPI_PATH: z.string().optional(),
  AUTH_SECRET: z.string().min(32),
  API_BASE_URL: z.string().url().default("http://localhost:8080"),
  WEB_BASE_URL: z.string().url().default("http://localhost:3001"),
  RESEND_API_KEY: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  APPLE_CLIENT_ID: z.string().min(1),
  APPLE_CLIENT_SECRET: z.string().min(1),
});

export const env = envSchema.parse(process.env);