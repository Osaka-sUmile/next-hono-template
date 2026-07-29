import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AuthInstance } from "@workspace/auth/server";
import type {
  GetActiveFeedbackSurveyUseCase,
  GetCurrentUserUseCase,
  GetFeedbackSurveyDetailUseCase,
  ListFeedbackSubmissionsUseCase,
  ListFeedbackSurveysUseCase,
  ListUsersUseCase,
  SubmitFeedbackUseCase,
  SummarizeFeedbackUseCase,
  UpdateUserProfileUseCase,
} from "../src/application";
import { buildApp } from "../src/composition/create-app";
import type { Env } from "../src/infrastructure";
// NOTE: presentation の barrel（`export * from ...`）経由ではなく実ファイルから直接 import する。
// このスクリプトは .mts（ESM）で、src 配下は apps/api に "type": "module" が無いため CJS として
// 解決される。ESM が CJS の named export を静的に検出する際は cjs-module-lexer を使うが、
// esbuild が `export *` を変換して生成するヘルパー（実行時ループでプロパティをコピーする形）は
// 静的解析できず、"does not provide an export named ..." で失敗する。実クラスを直接 export
// しているファイルから import すればこの問題を回避できる。
import { AdminController } from "../src/presentation/controllers/admin.controller";
import { FeedbackController } from "../src/presentation/controllers/feedback.controller";
import { HealthController } from "../src/presentation/controllers/health.controller";
import { UserController } from "../src/presentation/controllers/user.controller";

/**
 * OpenAPI ドキュメントを apps/api/openapi.json に書き出す。
 *
 * OpenAPI は `presentation/routes/` の Zod スキーマから OpenAPIHono が**実行時に**生成し
 * `/api-docs/openapi.json` で配信している（ディスク上にファイルは存在しない）。
 * apps/web の型生成（openapi-typescript）はファイルを入力に取るため、ここで実体化する。
 *
 * `createTestApp`（src/test-utils/app.ts）は vitest を import しているため素の Node からは
 * 使えない。同じ形のダミー依存をここで組み立てる。ハンドラーは一度も実行されず、
 * ルート定義とスキーマだけが読まれるため、依存の中身は空でよい。
 */

const OUTPUT_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "openapi.json");
const DOCUMENT_PATH = "/api-docs/openapi.json";

// buildApp が参照するのは NODE_ENV（エラーハンドラ）と WEB_BASE_URL（CORS）のみ。
// Zod 検証は通さないため、型を満たす最小限のダミー値を与える。
const stubEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://user:password@localhost:5432/openapi",
  AUTH_SECRET: "openapi-dump-secret-at-least-32-characters",
  API_BASE_URL: "http://localhost:8080",
  WEB_BASE_URL: "http://localhost:3000",
  RESEND_API_KEY: "openapi-dump",
  RESEND_FROM_EMAIL: "noreply@example.com",
  GOOGLE_CLIENT_ID: "openapi-dump",
  GOOGLE_CLIENT_SECRET: "openapi-dump",
  APPLE_CLIENT_ID: "openapi-dump",
  APPLE_CLIENT_SECRET: "openapi-dump",
  TURNSTILE_SECRET_KEY: "openapi-dump",
} satisfies Env;

async function main(): Promise<void> {
  const app = buildApp({
    env: stubEnv,
    auth: {} as AuthInstance,
    healthController: new HealthController(),
    userController: new UserController(
      {} as GetCurrentUserUseCase,
      {} as UpdateUserProfileUseCase,
    ),
    adminController: new AdminController({} as ListUsersUseCase),
    feedbackController: new FeedbackController(
      {} as GetActiveFeedbackSurveyUseCase,
      {} as SubmitFeedbackUseCase,
      {} as ListFeedbackSurveysUseCase,
      {} as GetFeedbackSurveyDetailUseCase,
      {} as ListFeedbackSubmissionsUseCase,
      {} as SummarizeFeedbackUseCase,
    ),
  });

  const res = await app.request(DOCUMENT_PATH);
  if (!res.ok) {
    throw new Error(`Failed to build the OpenAPI document: ${DOCUMENT_PATH} returned ${res.status}`);
  }

  const document: unknown = await res.json();
  // 差分を安定させるため 2 スペース整形 + 末尾改行で書き出す。
  await writeFile(OUTPUT_PATH, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

await main();
