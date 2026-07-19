import { vi } from "vitest";
import type { AuthInstance } from "@workspace/auth/server";
import type { GetCurrentUserUseCase, ListUsersUseCase } from "../application";
import { buildApp } from "../composition/create-app";
import { AdminController, HealthController, UserController } from "../presentation";
import type { Env } from "../infrastructure";

/**
 * テスト用の env スタブ。parseEnv を経由せず、テストに必要な最小限のキーのみ Env 型として与える。
 * NODE_ENV など個別のテストで上書きしたい値は `createTestApp` の `env` オーバーライドで渡すこと。
 */
const testEnv: Env = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://user:password@localhost:5432/test",
  AUTH_SECRET: "test-auth-secret-at-least-32-characters",
  API_BASE_URL: "http://localhost:8080",
  WEB_BASE_URL: "http://localhost:3000",
  RESEND_API_KEY: "test-resend-api-key",
  RESEND_FROM_EMAIL: "noreply@example.com",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  APPLE_CLIENT_ID: "test-apple-client-id",
  APPLE_CLIENT_SECRET: "test-apple-client-secret",
  TURNSTILE_SECRET_KEY: "test-turnstile-secret-key",
};

/**
 * テスト用に Hono アプリを組み立てるヘルパ。
 * better-auth の getSession と GetCurrentUserUseCase をモックに差し替え、
 * `app.request()` でルート全体（ミドルウェア＋ハンドラ＋onError）を統合的に検証する。
 */
export function createTestApp(
  overrides: {
    getSession?: ReturnType<typeof vi.fn>;
    execute?: ReturnType<typeof vi.fn>;
    listUsers?: ReturnType<typeof vi.fn>;
    env?: Partial<Env>;
  } = {},
) {
  const getSession = overrides.getSession ?? vi.fn();
  const execute = overrides.execute ?? vi.fn();
  const listUsers = overrides.listUsers ?? vi.fn();

  const auth = {
    api: { getSession },
    handler: vi.fn(),
  } as unknown as AuthInstance;

  const useCase = { execute } as unknown as GetCurrentUserUseCase;
  const listUsersUseCase = { execute: listUsers } as unknown as ListUsersUseCase;

  const app = buildApp({
    env: { ...testEnv, ...overrides.env },
    auth,
    healthController: new HealthController(),
    userController: new UserController(useCase),
    adminController: new AdminController(listUsersUseCase),
  });

  return { app, getSession, execute, listUsers };
}
