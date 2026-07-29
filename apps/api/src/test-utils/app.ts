import { vi } from "vitest"
import type { AuthInstance } from "@workspace/auth/server"
import type {
  GetActiveFeedbackSurveyUseCase,
  GetAdminSummaryUseCase,
  GetCurrentUserUseCase,
  GetFeedbackSurveyDetailUseCase,
  ListFeedbackSubmissionsUseCase,
  ListFeedbackSurveysUseCase,
  ListUsersUseCase,
  SubmitFeedbackUseCase,
  SummarizeFeedbackUseCase,
  UpdateUserProfileUseCase,
} from "../application"
import { buildApp } from "../composition/create-app"
import {
  AdminController,
  FeedbackController,
  HealthController,
  UserController,
} from "../presentation"
import type { Env } from "../infrastructure"

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
}

/**
 * テスト用に Hono アプリを組み立てるヘルパ。
 * better-auth の getSession と GetCurrentUserUseCase をモックに差し替え、
 * `app.request()` でルート全体（ミドルウェア＋ハンドラ＋onError）を統合的に検証する。
 */
export function createTestApp(
  overrides: {
    getSession?: ReturnType<typeof vi.fn>
    execute?: ReturnType<typeof vi.fn>
    updateProfile?: ReturnType<typeof vi.fn>
    listUsers?: ReturnType<typeof vi.fn>
    getAdminSummary?: ReturnType<typeof vi.fn>
    getFeedbackSurvey?: ReturnType<typeof vi.fn>
    submitFeedback?: ReturnType<typeof vi.fn>
    listFeedbackSurveys?: ReturnType<typeof vi.fn>
    getFeedbackSurveyDetail?: ReturnType<typeof vi.fn>
    listFeedbackSubmissions?: ReturnType<typeof vi.fn>
    summarizeFeedback?: ReturnType<typeof vi.fn>
    env?: Partial<Env>
  } = {}
) {
  const getSession = overrides.getSession ?? vi.fn()
  const execute = overrides.execute ?? vi.fn()
  const updateProfile = overrides.updateProfile ?? vi.fn()
  const listUsers = overrides.listUsers ?? vi.fn()
  const getAdminSummary = overrides.getAdminSummary ?? vi.fn()
  const getFeedbackSurvey = overrides.getFeedbackSurvey ?? vi.fn()
  const submitFeedback = overrides.submitFeedback ?? vi.fn()
  const listFeedbackSurveys = overrides.listFeedbackSurveys ?? vi.fn()
  const getFeedbackSurveyDetail = overrides.getFeedbackSurveyDetail ?? vi.fn()
  const listFeedbackSubmissions = overrides.listFeedbackSubmissions ?? vi.fn()
  const summarizeFeedback = overrides.summarizeFeedback ?? vi.fn()

  const auth = {
    api: { getSession },
    handler: vi.fn(),
  } as unknown as AuthInstance

  const useCase = { execute } as unknown as GetCurrentUserUseCase
  const updateUserProfileUseCase = {
    execute: updateProfile,
  } as unknown as UpdateUserProfileUseCase
  const listUsersUseCase = { execute: listUsers } as unknown as ListUsersUseCase
  const getAdminSummaryUseCase = {
    execute: getAdminSummary,
  } as unknown as GetAdminSummaryUseCase
  const getActiveFeedbackSurveyUseCase = {
    execute: getFeedbackSurvey,
  } as unknown as GetActiveFeedbackSurveyUseCase
  const submitFeedbackUseCase = {
    execute: submitFeedback,
  } as unknown as SubmitFeedbackUseCase
  const listFeedbackSurveysUseCase = {
    execute: listFeedbackSurveys,
  } as unknown as ListFeedbackSurveysUseCase
  const getFeedbackSurveyDetailUseCase = {
    execute: getFeedbackSurveyDetail,
  } as unknown as GetFeedbackSurveyDetailUseCase
  const listFeedbackSubmissionsUseCase = {
    execute: listFeedbackSubmissions,
  } as unknown as ListFeedbackSubmissionsUseCase
  const summarizeFeedbackUseCase = {
    execute: summarizeFeedback,
  } as unknown as SummarizeFeedbackUseCase

  const app = buildApp({
    env: { ...testEnv, ...overrides.env },
    auth,
    healthController: new HealthController(),
    userController: new UserController(useCase, updateUserProfileUseCase),
    adminController: new AdminController(
      listUsersUseCase,
      getAdminSummaryUseCase
    ),
    feedbackController: new FeedbackController(
      getActiveFeedbackSurveyUseCase,
      submitFeedbackUseCase,
      listFeedbackSurveysUseCase,
      getFeedbackSurveyDetailUseCase,
      listFeedbackSubmissionsUseCase,
      summarizeFeedbackUseCase
    ),
  })

  return {
    app,
    getSession,
    execute,
    updateProfile,
    listUsers,
    getAdminSummary,
    getFeedbackSurvey,
    submitFeedback,
    listFeedbackSurveys,
    getFeedbackSurveyDetail,
    listFeedbackSubmissions,
    summarizeFeedback,
  }
}
