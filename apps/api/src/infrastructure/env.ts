import { z } from "zod";

const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(8080),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1),
    OPENAPI_PATH: z.string().optional(),
    JWT_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: z.string().regex(/^\d+[smhd]$/, "Must be a duration like 15m, 1h, 7d").default("15m"),
    JWT_REFRESH_EXPIRES_IN: z.string().regex(/^\d+[smhd]$/, "Must be a duration like 15m, 1h, 7d").default("7d"),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().optional(),
    APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production") {
      const required = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"] as const;
      for (const field of required) {
        if (!data[field]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${field} is required in production`,
            path: [field],
          });
        }
      }
    }
  });

export const env = envSchema.parse(process.env);
