# Next.js, Hono テンプレートリポジトリ

## 概要
本プロジェクトは、フロントエンドおよびバックエンド、インフラ層を含むモノレポ (Turborepo) プロジェクトです。
アーキテクチャとして「DDD (Domain-Driven Design)」および「CQRS」をベースに構築されています。

## 初期セットアップ手順

1. **リポジトリのクローン・依存インストール**
   ```bash
   pnpm install
   ```

2. **環境変数の設定**
   環境変数は用途ごとにファイルが分かれています。それぞれ用意します。

   - ルートの `.env`（docker compose の Postgres 資格情報専用）
     ```bash
     cp .env.example .env
     ```
   - `packages/database/.env`（prisma CLI が読む DB 接続文字列）
     ```bash
     cp packages/database/.env.example packages/database/.env
     ```
   - `apps/api/.dev.vars`（API ローカル実行時の環境変数。`.dev.vars` は gitignore 対象）
     ```bash
     cp apps/api/.dev.vars.example apps/api/.dev.vars
     ```
   - `apps/web/.env.local`（Web ローカル実行時の環境変数）
     ```bash
     cp apps/web/.env.local.example apps/web/.env.local
     ```

   **値の埋め方（ローカル開発）:** ほとんどのファイルはコピーしたままで動きます。編集が必要なのは `apps/api/.dev.vars` のみ:
   - `AUTH_SECRET`: `openssl rand -base64 32` で生成した値に置き換える
   - `RESEND_API_KEY` / `GOOGLE_*` / `APPLE_*`: メール OTP・ソーシャルログインを試すときだけ実値が必要。それまでは example のダミー値のままで起動できます
   - `SENTRY_DSN`: 空のままで OK（エラー監視が無効になるだけ）
   - `TURNSTILE_SECRET_KEY`（`apps/api/.dev.vars`）/ `NEXT_PUBLIC_TURNSTILE_SITE_KEY`（`apps/web/.env.local`）: example は Cloudflare の公式テストキー（常にチャレンジが自動成功する）なので編集不要。実際のウィジェット作成手順は `docs/deployment.md` を参照してください

   preview / production 環境の整備（Cloudflare / Neon / GitHub Secrets、Turnstile ウィジェットの作成）は `docs/deployment.md` のセットアップチェックリストを参照してください。

3. **データベースの起動 (Docker)**
   Docker を使ってローカルの PostgreSQL と、Neon serverless driver 用の wsproxy を起動します。
   apps/api (Cloudflare Workers ランタイム) はこの wsproxy 経由でローカル Postgres に接続します。
   ```bash
   docker compose -f docker-compose.yml up -d db neon-wsproxy
   ```

4. **Prisma スキーマの反映・クライアント生成**
   ```bash
   pnpm --filter @workspace/database run db:generate
   # 初回やスキーマ変更時は db:push を行います
   # pnpm --filter @workspace/database exec prisma db push
   ```

5. **開発サーバーの起動**
   ```bash
   pnpm dev
   ```
   - API: `wrangler dev` の起動ログに表示されるポートで `/api-docs` (Swagger UI) にアクセスできます
   - Web: `http://localhost:3000` (Next.js)

6. **最初の管理者を作成**

   先に Web から通常どおりサインアップし、そのメールアドレスを指定して昇格スクリプトを実行します。

   ```bash
   pnpm --filter @workspace/database promote-admin -- user@example.com
   ```

   `DATABASE_URL` のホストが `localhost` または `127.0.0.1` の場合は、ローカルの wsproxy 接続が自動的に有効になります。
   別のホスト名でローカル wsproxy を使う場合は、末尾に `--local` を付けてください。
   対象ユーザーが存在しない場合は昇格できないため、先にサインアップが必要です。

   昇格後は再ログインするか、認証セッションを再取得して新しい role を反映してください。
   管理者向け role 変更 API の導入後は、2 人目以降の昇格には管理画面からその API を使います。

## 開発ガイドライン
- `CLAUDE.md`: 新機能追加のフローや命名・バリデーション規則
- `docs/architecture.md`: 依存関係のルールやアーキテクチャ概要

## Web (apps/web) のデプロイ

`apps/web` は [OpenNext](https://opennext.js.org/cloudflare) を用いて **Cloudflare Workers** にデプロイします（Docker ではなく Cloudflare を利用します）。

**💡 主なコマンド (apps/web 配下で実行):**

| コマンド | 説明 |
|------------------|--------------------------------------------------------------------|
| `pnpm build`     | 既存の `next build`（Next.js アプリのビルド） |
| `pnpm preview`   | OpenNext でビルドし、ローカルの workerd 上でプレビュー起動 |
| `pnpm run deploy`| OpenNext でビルドし、Cloudflare Workers へデプロイ |
| `pnpm cf-typegen`| `wrangler.jsonc` の bindings から `cloudflare-env.d.ts` を再生成 |

> ⚠️ `deploy` は `pnpm` 自身の予約コマンド(workspace デプロイ機能)と名前が衝突するため、`pnpm deploy` ではなく `pnpm run deploy` と実行してください。
> なお、デプロイは CI（GitHub Actions）経由が原則です。`pnpm run deploy` をローカルで実行するのは初回セットアップ（URL 確定のための手動デプロイ）のみとし、それ以外では実行しないでください。誤実行防止のため CI 以外ではデフォルトでブロックされます（初回など意図的に実行する場合のみ `ALLOW_LOCAL_DEPLOY=1` を付与。詳細は `docs/deployment.md`）。

**環境変数について:**
- ローカル開発では `apps/web/.env.local.example` を `.env.local` としてコピーしてください（`.env.local` は Git 管理対象外）。
- `NEXT_PUBLIC_*` はビルド時にクライアントバンドルへインライン展開されるため、`wrangler.jsonc` の `vars` に設定するだけではブラウザ側に反映されません。`pnpm build` (= `opennextjs-cloudflare build`) の実行前に、`apps/web/.env.local` や CI のシークレット経由で値を供給してください。
- サーバー側 (Node.js ランタイム) から参照する値は `wrangler.jsonc` の `vars` で管理します。
- ローカルで `wrangler dev` / `opennextjs-cloudflare preview` 用の変数を使う場合は `apps/web/.dev.vars.example` を `.dev.vars` としてコピーしてください（`.dev.vars` は Git 管理対象外）。

本番の Neon 接続・シークレット設定・マイグレーション運用については `docs/deployment.md` を参照してください。

## Testing & CI/CD

このリポジトリでは品質保証のため、ユニットテストからE2Eテスト、CI/CD環境までを整備しています。

### テストの全体マップ（どこに・どんなテストを書くか）

「単体か結合か」を一律に決めるのではなく、**層ごとにテストの主戦場を変える**方針です。テストランナーは **[Vitest](https://vitest.dev/)**（E2E のみ [Playwright](https://playwright.dev/)）を採用しています。

| 場所 | テストの種類 | 手法 | 何を検証するか |
|------|------------|------|--------------|
| `packages/domain` | 単体テスト | Vitest | エンティティ・値オブジェクトのビジネスルール。外部依存ゼロのため高速に全ルールを検証できる |
| `packages/auth` | 単体テスト | Vitest | better-auth ラッパーの設定・認証契約 |
| `packages/database` | **結合テスト（実 DB）** | Vitest + docker の Postgres/wsproxy | repository / query-service のクエリの正しさ・スキーマとの整合・制約違反。**PrismaClient のモックによる単体テストは原則禁止**（モックでは where 句の誤りやスキーマドリフトを検出できないため）。例外: 複雑化した変換ロジックは `mappers/` の純関数に切り出して単体テスト |
| `apps/api` application 層 | 単体テスト | Vitest（リポジトリはモック） | ユースケースの分岐・エラー変換。ビジネスルール自体は domain 側でテスト済みなので重複させない |
| `apps/api` presentation 層 | 統合テスト | Vitest + Hono の `app.request()` | ルーティング・Zod バリデーション・HTTP エラーへの変換・ミドルウェア（認証/認可） |
| `apps/web` | 単体テスト | Vitest + jsdom + React Testing Library | コンポーネント・hooks・lib。`app/*.test.tsx` のように co-located で置く |
| `apps/web/tests/e2e` | E2E テスト | Playwright | 認証フロー等、画面をまたぐシナリオ |

**配置ルール（共通）:**
- Vitest のテストは実装ファイルと同じ階層に `*.test.ts` / `*.test.tsx` を置く（co-located）。`__tests__/` ディレクトリは作らない。
- テスト共通ユーティリティは `<app>/src/test-utils/` に集約する。

詳細な理由付けは `CLAUDE.md`「層別テスト戦略」、`docs/architecture.md`、`packages/database/CLAUDE.md` を参照してください。

**💡 主なコマンド:**

| 対象 | コマンド | 説明 |
|---------|--------------------------------|------------------------------------------------------|
| **全体** | `pnpm test` | ワークスペース全体のテストを一度だけ実行 (turbo経由)。DB 結合テストは実 DB を要するため含まない |
| **Web** | `pnpm --filter web test:watch` | フロントエンドのテストをウォッチモードで実行 |
| **API** | `pnpm --filter api test:watch` | バックエンドのテストをウォッチモードで実行 |

### DB 結合テスト (packages/database)

`packages/database` は**実 DB への結合テストが標準**です（`PrismaClient` のモックは原則禁止）。docker の Postgres + wsproxy に対して実行するため、`pnpm test`（turbo）には含めず `test:integration` で明示的に実行します。

**💡 実行手順（初回・ローカル）:**

```bash
# 1. docker 用の資格情報と prisma/テスト用の接続文字列を用意
cp .env.example .env
cp packages/database/.env.example packages/database/.env

# 2. Postgres + wsproxy を起動
docker compose up -d db neon-wsproxy

# 3. 初回のみ、結合テスト専用 DB を明示的に作成
#    （すでに app_test が存在する場合は不要）
docker compose exec db sh -c 'createdb --username "$POSTGRES_USER" "${POSTGRES_DB}_test"'

# 4. テスト DB にマイグレーションを適用
pnpm --filter @workspace/database db:test:migrate:deploy

# 5. 結合テストを実行
pnpm --filter @workspace/database test:integration
```

- 結合テストは `packages/database/.env` の `TEST_DATABASE_URL` のみを使用します。開発用の `DATABASE_URL` にはフォールバックしません。
- 誤 truncate 防止のため、`TEST_DATABASE_URL` のデータベース名は `_test` で終わる必要があります。
- テスト DB の作成とマイグレーションは自動実行されません。初回作成と、マイグレーション追加後の `db:test:migrate:deploy` を明示的に実行してください。
- ウォッチ実行は `pnpm --filter @workspace/database test:integration:watch`。
- テスト間の独立性は `src/test-utils` の `resetDatabase`（各テストの `beforeEach` で truncate）で担保します。
- CI では `.github/workflows/test-db.yml` が同じ docker 構成で自動実行します。

### E2Eテスト (End-to-End Tests)
フロントエンドの全体的なUIテストやシナリオテストには **[Playwright](https://playwright.dev/)** を使用しています。コードは `apps/web/tests/e2e` ディレクトリに配置しています。

**💡 主なコマンド (apps/web 配下で実行):**

| コマンド | 説明 |
|----------------------------------|----------------------------------------------------------|
| `pnpm exec playwright test` | ヘッドレスで全E2Eテストを実行 |
| `pnpm exec playwright test --ui` | UIモード（ブラウザ有り）でインタラクティブにテストを実行 |

### 自動検証 (Automated Checks)

| 種別 | 設定・ファイル | 概要 |
|-------------------|----------------------------------|--------------------------------------------------------------------------------|
| **Git Hooks** | `.husky/pre-commit` | コミット前に自動的に `pnpm run typecheck` → `pnpm run lint` → `pnpm run test` を実行し、問題があれば中断 |
| **CI (Lint)** | `.github/workflows/lint.yml` | PR時に変更されたフロント・バックエンドファイルに対して `eslint` を実行 |
| **CI (E2Eテスト)** | `.github/workflows/e2e.yml` | Playwright を用いたフロントエンドのE2Eテストを実行 |
| **CD (デプロイ)** | `.github/workflows/deploy.yml` | develop → preview / main → production へ Cloudflare Workers に自動デプロイ（詳細は `docs/deployment.md`） |

※ **注意:** GitHub Actions の実行時間（制限・コスト）を節約するため、**CI 上での単体テスト自動実行は行わない方針** としています。コードの品質保証に関する単体テストは、コミット時の Git Hooks (`pre-commit`) で自己検証される前提です。
