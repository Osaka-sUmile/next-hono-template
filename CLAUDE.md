# 開発ガイドライン (Actionable Rules)

## 実装フロー (Feature Implementation Flow)
新規機能追加時は以下の順序で作成すること。
1. **Domain (packages/domain)**: エンティティ・リポジトリインターフェース (`*.entity.ts`, `*.repository.ts`)
2. **Database (packages/database)**: リポジトリ実装・クエリサービス (`*.prisma-repository.ts`, `*.query-service.ts`)
3. **Application (apps/api/src/application)**: ユースケース (`*.use-case.ts`) (Command / Query を分離し、Command は副作用あり、Query は参照のみ)
4. **Presentation (apps/api/src/presentation)**: `routes/` に `createRoute` と入出力 Zod スキーマ、`controllers/` にハンドラーを実装する

## CQRS の使い分け
- **Command**: 副作用ありの処理。必要なら UseCase 内で `prisma.$transaction` を張る。
- **Query**: 参照のみの処理。原則として読み取り専用 DTO を返し、Entity の復元は必須ではない。

## DTO / エラーの責務
- **Request DTO**: `presentation/routes/` の `createRoute.request` Zod スキーマから `c.req.valid()` で得る。
- **Response DTO**: Application で組み立て、その形を `routes/` の Zod レスポンススキーマで宣言する。
- **Domain Error**: `packages/domain/src/errors/` に置き、必ず次のどちらかへ分類する。
  - `DomainRuleViolationError`: 形式上は正しい操作が業務ルールを満たさず、利用者が修正できる拒否。
  - `DomainInvariantError`: DB 不整合・復元失敗・プログラム上の前提違反。500 + Sentry の対象。
- **Application Error**: `apps/api/src/application/errors/` に置き、ユースケース上で正常に起こり得る失敗を表す。
- `DomainRuleViolationError` は Application 境界でユースケース固有の `ApplicationError` へ翻訳する。Presentation から `@workspace/domain` を import して直接 catch してはならない。
- Presentation は `ApplicationError` の具体型を HTTP ステータス・公開エラーコードへ変換する。`DomainInvariantError` とその他の想定外エラーは捕捉せず、中央エラーハンドラの 500 + Sentry へ流す。

## エラーコードの追加手順
`apps/api/src/presentation/errors/error-codes.ts` の `ErrorCodes` に 1 行追加するだけでよい。
`ErrorCode` 型と OpenAPI の enum は `presentation/openapi/error.schema.ts` の `z.enum(ErrorCodes)` から導出されるため、同期させる箇所は存在しない。

## エンドポイントの追加手順
1. `presentation/routes/<resource>.route.ts` に `createRoute` と request/response の Zod スキーマを書く。
2. `presentation/controllers/<resource>.controller.ts` にハンドラーを足し、`c.req.valid("json")` で型付き入力を取る。
3. `composition/create-app.ts` に `v1.openapi(<route>, deps.<controller>.<handler>)` を 1 行足す。認証・認可が必要なら `v1.use(path, ...)` も追加する。
4. co-located テストへ正常系・異常系を追加する。
5. `pnpm run openapi:generate` を実行し、生成された `apps/api/openapi.json` と `apps/web/lib/api-schema.d.ts` をコミットする。

## テスト配置
- **Vitest**: 実装と同じ階層に `*.test.ts` / `*.test.tsx` を co-located で置く。
- **Playwright**: `apps/web/tests/e2e/` に集約する。
- **テスト共通ユーティリティ**: `<app>/src/test-utils/` に集約し、`__tests__/helpers/` 等の独自階層は作らない。

## 層別テスト戦略
「単体か結合か」ではなく、層ごとにテストの主戦場を変える。

| 層 | 主戦場 | 補足 |
| :--- | :--- | :--- |
| packages/domain | 単体テスト | エンティティ・値オブジェクトのビジネスルール検証 |
| apps/api/src/application | 単体テスト（リポジトリはモック） | ユースケースの分岐・エラー変換の検証 |
| packages/database | **結合テスト（実 DB）** | PrismaClient のモックは原則禁止。詳細は `packages/database/CLAUDE.md` |
| apps/web | 単体テスト + Playwright E2E | `docs/frontend-guidelines.md` を参照 |

## apps/web のルール
- フロントエンドの詳細ガイドライン（フォルダ構成・コンポーネント追加・スタイリング・Server/Client Components・API 呼び出し）は `docs/frontend-guidelines.md` を参照すること。

## クライアントエラーと Sentry
- catch 節では必ず `reportError(error)`（`apps/web/lib/report-error.ts`）を呼ぶ。
- ユーザー操作で当然起きうる想定内エラーのみ `throw new ExpectedError(...)` で印を付け、Sentry 送信を抑制する。
- 判断に迷うものは「送る」側（= 印を付けない）に倒す。
- better-auth クライアントが返す `{ error }`（コード不一致等）は想定内なので UI 通知のみで可。
- 詳細は `docs/frontend-guidelines.md` の「エラーハンドリング・Sentry」セクションを参照すること。

## バリデーション境界
- **入力 (Presentation)**: `createRoute.request` の Zod スキーマ（zValidator）で型と形式を検証する。`routes/` と `openapi/` では `@hono/zod-openapi` の `z` を使う。
- **ビジネス (Domain)**: エンティティメソッド内で整合性を検証。

## エクスポート/インポート規則 (Barrel Pattern)
- 各層のディレクトリ（`repositories` 等）内に `index.ts` を置き、同一パッケージ内の公開モジュールを束ねること。
- 外部パッケージからのインポートは、各 package の `package.json` に定義された公開エントリーポイント経由に限定すること。
- つまり、`index.ts` は「内部整理のための束ね役」であり、外部から深い階層を直接 import するための口ではない。

## 環境変数
- 起動時に `apps/api/src/infrastructure/env.ts` で Zod 検証を通すこと。
- `process.env` の直接参照は最小限にし、アプリ内では型付きの `env` を使うこと。

## 参照資料
- バックエンドの設計ルール・フォルダ構造 : `docs/architecture.md`
- フロントエンドの開発ガイドライン : `docs/frontend-guidelines.md`
