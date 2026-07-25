import { describe, expect, it } from "vitest";
import { envSchema } from "./env";

const validEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://user:password@localhost:5432/test",
  AUTH_SECRET: "test-auth-secret-at-least-32-characters",
  RESEND_API_KEY: "test-resend-api-key",
  RESEND_FROM_EMAIL: "noreply@example.com",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  APPLE_CLIENT_ID: "test-apple-client-id",
  APPLE_CLIENT_SECRET: "test-apple-client-secret",
  TURNSTILE_SECRET_KEY: "test-turnstile-secret-key",
};

describe("envSchema", () => {
  it("uses the canonical API origin when API_BASE_URL is omitted", () => {
    expect(envSchema.parse(validEnv).API_BASE_URL).toBe("http://localhost:8080");
  });

  it("rejects API origins with a path or query", () => {
    expect(() => envSchema.parse({ ...validEnv, API_BASE_URL: "https://api.example.com/v1" })).toThrow();
    expect(() => envSchema.parse({ ...validEnv, API_BASE_URL: "https://api.example.com?x=1" })).toThrow();
  });

  it("validates the sender email format", () => {
    expect(() => envSchema.parse({ ...validEnv, RESEND_FROM_EMAIL: "not-an-email" })).toThrow();
  });
});
