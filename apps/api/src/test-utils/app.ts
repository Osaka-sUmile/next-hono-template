import { vi } from "vitest";
import type { AuthInstance } from "@workspace/auth/server";
import type { GetCurrentUserUseCase } from "../application";
import { buildApp } from "../composition/create-app";
import { HealthController, UserController } from "../presentation";

/**
 * テスト用に Hono アプリを組み立てるヘルパ。
 * better-auth の getSession と GetCurrentUserUseCase をモックに差し替え、
 * `app.request()` でルート全体（ミドルウェア＋ハンドラ＋onError）を統合的に検証する。
 */
export function createTestApp(overrides: {
  getSession?: ReturnType<typeof vi.fn>;
  execute?: ReturnType<typeof vi.fn>;
} = {}) {
  const getSession = overrides.getSession ?? vi.fn();
  const execute = overrides.execute ?? vi.fn();

  const auth = {
    api: { getSession },
    handler: vi.fn(),
  } as unknown as AuthInstance;

  const useCase = { execute } as unknown as GetCurrentUserUseCase;

  const app = buildApp({
    auth,
    healthController: new HealthController(),
    userController: new UserController(useCase),
  });

  return { app, getSession, execute };
}
