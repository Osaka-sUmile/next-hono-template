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
    expect(() => envSchema.parse({ ...validEnv, API_BASE_URL: "https://api.example.com#fragment" })).toThrow();
  });

  it("normalizes WEB_BASE_URL to an origin and rejects a fragment", () => {
    expect(envSchema.parse({ ...validEnv, WEB_BASE_URL: "https://web.example.com/" }).WEB_BASE_URL).toBe(
      "https://web.example.com",
    );
    expect(() => envSchema.parse({ ...validEnv, WEB_BASE_URL: "https://web.example.com#fragment" })).toThrow();
  });

  it("validates optional SENTRY_DSN", () => {
    expect(envSchema.parse(validEnv).SENTRY_DSN).toBeUndefined();
    expect(envSchema.parse({ ...validEnv, SENTRY_DSN: "https://sentry.example.com/123" }).SENTRY_DSN).toBe(
      "https://sentry.example.com/123",
    );
    expect(() => envSchema.parse({ ...validEnv, SENTRY_DSN: "" })).toThrow();
    expect(() => envSchema.parse({ ...validEnv, SENTRY_DSN: null })).toThrow();
  });

  it("validates the sender email format", () => {
    expect(() => envSchema.parse({ ...validEnv, RESEND_FROM_EMAIL: "not-an-email" })).toThrow();
  });
});
