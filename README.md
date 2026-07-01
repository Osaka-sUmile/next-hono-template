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
   ルートディレクトリ（および必要に応じて `apps/api/`, `apps/web/` 等）に `.env` を作成します。
   ```bash
   cp .env.example .env
   ```

3. **データベースの起動 (Docker)**
   Docker を使ってローカルの PostgreSQL を起動します。
   ```bash
   docker compose -f docker-compose.yml up -d
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
   - API: `http://localhost:8080/api-docs` (Swagger UI)
   - Web: `http://localhost:3000` (Next.js)

## 開発ガイドライン
- `CLAUDE.md`: 新機能追加のフローや命名・バリデーション規則
- `docs/architecture.md`: 依存関係のルールやアーキテクチャ概要

## Testing & CI/CD

このリポジトリでは品質保証のため、ユニットテストからE2Eテスト、CI/CD環境までを整備しています。

### 単体テスト (Unit Tests)
高速なテストランナーである **[Vitest](https://vitest.dev/)** を採用しています。

- **Frontend (`apps/web`)**: `jsdom` および `React Testing Library` を用いて、`app/*.test.tsx` や `components/**/*.test.tsx` のように co-located でテストを置きます。
- **Backend (`apps/api`)**: Hono の `app.request()` を用いて、APIエンドポイントの統合テストを行います。

**💡 主なコマンド:**

| 対象 | コマンド | 説明 |
|---------|--------------------------------|------------------------------------------------------|
| **全体** | `pnpm test` | ワークスペース全体の単体テストを一度だけ実行 (turbo経由) |
| **Web** | `pnpm --filter web test:watch` | フロントエンドのテストをウォッチモードで実行 |
| **API** | `pnpm --filter api test:watch` | バックエンドのテストをウォッチモードで実行 |

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

※ **注意:** GitHub Actions の実行時間（制限・コスト）を節約するため、**CI 上での単体テスト自動実行は行わない方針** としています。コードの品質保証に関する単体テストは、コミット時の Git Hooks (`pre-commit`) で自己検証される前提です。

