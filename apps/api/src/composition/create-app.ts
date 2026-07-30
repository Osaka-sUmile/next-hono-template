import { OpenAPIHono } from "@hono/zod-openapi"
import { cors } from "hono/cors"
import { secureHeaders } from "hono/secure-headers"
import { createAuth } from "@workspace/auth/server"
import type { AuthInstance } from "@workspace/auth/server"
import {
  AdminQueryService,
  createPrismaClient,
  FeedbackQueryService,
  FeedbackSubmissionPrismaRepository,
  FeedbackSurveyPrismaRepository,
  UserPrismaRepository,
  UserQueryService,
} from "@workspace/database"
import {
  ChangeUserRoleUseCase,
  CreateFeedbackSurveyUseCase,
  DeleteFeedbackSurveyUseCase,
  DuplicateFeedbackSurveyUseCase,
  GetActiveFeedbackSurveyUseCase,
  GetAdminSummaryUseCase,
  GetCurrentUserUseCase,
  GetFeedbackSurveyDetailUseCase,
  ListFeedbackSubmissionsUseCase,
  ListFeedbackSurveysUseCase,
  ListUsersUseCase,
  ReplaceFeedbackSurveyQuestionsUseCase,
  SubmitFeedbackUseCase,
  SummarizeFeedbackUseCase,
  UpdateFeedbackSurveyUseCase,
  UpdateUserProfileUseCase,
} from "../application"
import {
  AdminController,
  FeedbackController,
  HealthController,
  UserController,
  createAuthLimiter,
  createFeedbackSubmitLimiter,
  createErrorHandler,
  createRequireAuth,
  requireAdmin,
  changeUserRoleRoute,
  createFeedbackSurveyRoute,
  deleteFeedbackSurveyRoute,
  duplicateFeedbackSurveyRoute,
  healthRoute,
  getAdminSummaryRoute,
  getUserMeRoute,
  updateUserMeRoute,
  listUsersRoute,
  getActiveFeedbackSurveyRoute,
  submitFeedbackRoute,
  listFeedbackSurveysRoute,
  replaceFeedbackSurveyQuestionsRoute,
  getFeedbackSurveyDetailRoute,
  listFeedbackSubmissionsRoute,
  summarizeFeedbackRoute,
  updateFeedbackSurveyRoute,
  validationErrorHook,
  type AppEnv,
} from "../presentation"
import { setupSwagger, UuidIdGenerator, type Env } from "../infrastructure"

export type AppDeps = {
  env: Env
  auth: AuthInstance
  healthController: HealthController
  userController: UserController
  adminController: AdminController
  feedbackController: FeedbackController
}

/**
 * 依存を受け取り Hono アプリを組み立てる。
 * 実依存の構築は createApp() が担い、テストではモック依存を渡して app.request() で検証する。
 */
export function buildApp(deps: AppDeps): OpenAPIHono<AppEnv> {
  const app = new OpenAPIHono<AppEnv>({ defaultHook: validationErrorHook })

  // 未処理エラーは onError で一元的に捕捉する（Sentry 送信・ログもここで実施）。
  app.onError(createErrorHandler(deps.env.NODE_ENV))

  app.use(secureHeaders())
  // cors はすべてのルートに適用するため先行させる
  app.use(cors({ origin: deps.env.WEB_BASE_URL, credentials: true }))

  // better-auth ハンドラ。Web 標準の Request をそのまま渡す。
  // レート制限は認証ミューテーション系(メール送信・サインイン・パスワードリセット)のみに絞る。
  // /api/auth/* 全体にかけると get-session 等の高頻度な参照系まで巻き込み、共有 IP 環境で
  // アプリ全体が誤 429 になりうるため。
  app.use("/api/auth/email-otp/*", createAuthLimiter())
  app.use("/api/auth/sign-in/*", createAuthLimiter())
  app.use("/api/auth/forget-password/*", createAuthLimiter())
  app.on(["GET", "POST"], "/api/auth/*", (c) => deps.auth.handler(c.req.raw))

  const requireAuth = createRequireAuth(deps.auth)

  const v1 = new OpenAPIHono<AppEnv>({ defaultHook: validationErrorHook })
  // v1 配下のデフォルトキャッシュ方針。個別ハンドラが上書き可能なよう next() より前に設定する。
  v1.use(async (c, next) => {
    c.header("Cache-Control", "private, no-cache, no-store, must-revalidate")
    await next()
  })
  // 認証・認可は composition に集約し、入出力契約は routes/ が担う。
  v1.use("/me", requireAuth)
  // /admin 配下は 1 本のワイルドカードでまとめて守る。Hono のパスは完全一致なので
  // "/admin/users" のような個別指定では "/admin/users/{userId}/role" のような
  // ネストしたルートがガードから漏れる。新しい admin ルートを足すたびに
  // ミドルウェア登録を追う必要をなくすため、ここは必ず "/admin/*" のままにすること。
  v1.use("/admin/*", requireAuth, requireAdmin)
  // フィードバックは回答者を認証セッションから決めるため参照・投稿の双方で認証を要求する。
  // 回答者の氏名・メール・自由記述を含む管理系は上の /admin/* が admin に限定する。
  v1.use("/feedback/*", requireAuth)
  v1.use("/feedback/submissions", createFeedbackSubmitLimiter())
  v1.openapi(healthRoute, deps.healthController.check)
  v1.openapi(getUserMeRoute, deps.userController.getUserMe)
  v1.openapi(updateUserMeRoute, deps.userController.updateUserMe)
  v1.openapi(getAdminSummaryRoute, deps.adminController.getSummary)
  v1.openapi(listUsersRoute, deps.adminController.listUsers)
  v1.openapi(changeUserRoleRoute, deps.adminController.changeUserRole)
  v1.openapi(
    getActiveFeedbackSurveyRoute,
    deps.feedbackController.getActiveSurvey
  )
  v1.openapi(submitFeedbackRoute, deps.feedbackController.submitFeedback)
  v1.openapi(listFeedbackSurveysRoute, deps.feedbackController.listSurveys)
  v1.openapi(
    getFeedbackSurveyDetailRoute,
    deps.feedbackController.getSurveyDetail
  )
  v1.openapi(
    listFeedbackSubmissionsRoute,
    deps.feedbackController.listSubmissions
  )
  v1.openapi(summarizeFeedbackRoute, deps.feedbackController.getSummary)
  v1.openapi(createFeedbackSurveyRoute, deps.feedbackController.createSurvey)
  v1.openapi(updateFeedbackSurveyRoute, deps.feedbackController.updateSurvey)
  v1.openapi(
    replaceFeedbackSurveyQuestionsRoute,
    deps.feedbackController.replaceSurveyQuestions
  )
  v1.openapi(
    duplicateFeedbackSurveyRoute,
    deps.feedbackController.duplicateSurvey
  )
  v1.openapi(deleteFeedbackSurveyRoute, deps.feedbackController.deleteSurvey)

  app.route("/api/v1", v1)

  setupSwagger(app)

  return app
}

/**
 * createApp の戻り値。
 * Neon serverless driver の接続 (WebSocket) を保持する prisma は Workers の
 * 「リクエスト跨ぎ I/O 禁止」制約によりリクエスト間で使い回せないため、リクエスト
 * 単位で構築し、レスポンス後に prisma.$disconnect() で後始末する必要がある。
 * 呼び出し側 (index.ts) がクリーンアップできるよう prisma も併せて返す。
 */
export type CreatedApp = {
  app: OpenAPIHono<AppEnv>
  prisma: ReturnType<typeof createPrismaClient>
}

export async function createApp(env: Env): Promise<CreatedApp> {
  const prisma = createPrismaClient(env.DATABASE_URL, {
    queryLogging: env.NODE_ENV === "development",
    localProxy: env.NODE_ENV === "development",
  })
  try {
    const auth = createAuth({
      prisma,
      secret: env.AUTH_SECRET,
      baseURL: env.API_BASE_URL,
      webBaseURL: env.WEB_BASE_URL,
      trustedOrigins: [env.WEB_BASE_URL],
      resendApiKey: env.RESEND_API_KEY,
      resendFromEmail: env.RESEND_FROM_EMAIL,
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
      apple: {
        clientId: env.APPLE_CLIENT_ID,
        clientSecret: env.APPLE_CLIENT_SECRET,
      },
      turnstile: { secretKey: env.TURNSTILE_SECRET_KEY },
    })

    const userQueryService = new UserQueryService(prisma)
    const adminQueryService = new AdminQueryService(prisma)
    const userRepository = new UserPrismaRepository(prisma)
    const getCurrentUserUseCase = new GetCurrentUserUseCase(userQueryService)
    const listUsersUseCase = new ListUsersUseCase(userQueryService)
    const getAdminSummaryUseCase = new GetAdminSummaryUseCase(adminQueryService)
    const updateUserProfileUseCase = new UpdateUserProfileUseCase(
      userRepository
    )
    const changeUserRoleUseCase = new ChangeUserRoleUseCase(userRepository)

    const feedbackQueryService = new FeedbackQueryService(prisma)
    const feedbackSurveyRepository = new FeedbackSurveyPrismaRepository(prisma)
    const feedbackSubmissionRepository = new FeedbackSubmissionPrismaRepository(
      prisma
    )
    const idGenerator = new UuidIdGenerator()
    const getActiveFeedbackSurveyUseCase = new GetActiveFeedbackSurveyUseCase(
      feedbackQueryService
    )
    const submitFeedbackUseCase = new SubmitFeedbackUseCase(
      feedbackSurveyRepository,
      feedbackSubmissionRepository,
      idGenerator
    )
    const listFeedbackSurveysUseCase = new ListFeedbackSurveysUseCase(
      feedbackQueryService
    )
    const getFeedbackSurveyDetailUseCase = new GetFeedbackSurveyDetailUseCase(
      feedbackQueryService
    )
    const listFeedbackSubmissionsUseCase = new ListFeedbackSubmissionsUseCase(
      feedbackQueryService
    )
    const summarizeFeedbackUseCase = new SummarizeFeedbackUseCase(
      feedbackQueryService
    )
    const createFeedbackSurveyUseCase = new CreateFeedbackSurveyUseCase(
      feedbackSurveyRepository,
      idGenerator
    )
    const updateFeedbackSurveyUseCase = new UpdateFeedbackSurveyUseCase(
      feedbackSurveyRepository
    )
    const replaceFeedbackSurveyQuestionsUseCase =
      new ReplaceFeedbackSurveyQuestionsUseCase(
        feedbackSurveyRepository,
        idGenerator
      )
    const duplicateFeedbackSurveyUseCase = new DuplicateFeedbackSurveyUseCase(
      feedbackSurveyRepository,
      idGenerator
    )
    const deleteFeedbackSurveyUseCase = new DeleteFeedbackSurveyUseCase(
      feedbackSurveyRepository
    )

    const app = buildApp({
      env,
      auth,
      healthController: new HealthController(),
      userController: new UserController(
        getCurrentUserUseCase,
        updateUserProfileUseCase
      ),
      adminController: new AdminController(
        listUsersUseCase,
        getAdminSummaryUseCase,
        changeUserRoleUseCase
      ),
      feedbackController: new FeedbackController(
        getActiveFeedbackSurveyUseCase,
        submitFeedbackUseCase,
        listFeedbackSurveysUseCase,
        getFeedbackSurveyDetailUseCase,
        listFeedbackSubmissionsUseCase,
        summarizeFeedbackUseCase,
        createFeedbackSurveyUseCase,
        updateFeedbackSurveyUseCase,
        replaceFeedbackSurveyQuestionsUseCase,
        duplicateFeedbackSurveyUseCase,
        deleteFeedbackSurveyUseCase
      ),
    })

    return { app, prisma }
  } catch (error) {
    // 構築途中で失敗した場合、呼び出し側(index.ts)は prisma を受け取れず後始末できないためここで解放する。
    // $disconnect() 自体の失敗で元の構築エラーを握り潰さないよう、後始末のエラーは無視して元の error を再送出する。
    await prisma.$disconnect().catch(() => {})
    throw error
  }
}
