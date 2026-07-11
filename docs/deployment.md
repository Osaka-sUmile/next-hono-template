# 本番デプロイ・Neon 接続ガイド

## 環境変数の全体像

環境変数は用途ごとにファイル・設定場所が分かれている。ローカル開発用の対応関係は `.env.example` にも記載しているが、本番デプロイ時の到達点まで含めて整理すると以下の通り。

| 用途 | ローカル | 本番 |
| :--- | :--- | :--- |
| docker compose (Postgres 資格情報) | ルート `.env` | (本番では docker を使わないため対象外) |
| API ランタイム (`apps/api`) | `apps/api/.dev.vars` | `wrangler secret put` (シークレット) + `apps/api/wrangler.jsonc` の `vars` (非シークレット) |
| DB マイグレーション/Studio (`packages/database`) | `packages/database/.env` | CI/シェルの環境変数 (`DATABASE_URL`) |
| web (`apps/web`) | `apps/web/.env.local` | ビルド実行環境の環境変数 (`NEXT_PUBLIC_*`) |

本番の API ランタイムと DB マイグレーションは、どちらも `DATABASE_URL` という同じ名前の変数を使うが、**接続文字列の種類が異なる**(次節参照)。

## Neon プロジェクトのプロビジョニング

1. [Neon Console](https://console.neon.tech/) でプロジェクトを作成する。
2. 環境ごとに Neon の**ブランチ**を分けることを推奨する(例: `production`、`preview`)。Neon のブランチは Postgres のコピーオンライトブランチで、本番データに影響を与えずスキーマ検証や動作確認ができる。
3. 各ブランチについて、接続文字列が **2 種類**発行されることを確認する。

### 接続文字列の 2 系統

Neon はプールされた接続とプールされていない接続の 2 種類の接続文字列を提供する。**用途によって使い分けが必須**。

| 種類 | ホスト名の特徴 | 用途 | 使用箇所 |
| :--- | :--- | :--- | :--- |
| pooled | `-pooler` サフィックスあり | Neon serverless driver (`@neondatabase/serverless` + `@prisma/adapter-neon`) 経由の接続 | API Worker ランタイムの `DATABASE_URL` (`wrangler secret put`) |
| direct (non-pooled) | `-pooler` サフィックスなし | prisma CLI (`prisma migrate` 等) が Node/TCP で直接接続する経路 | マイグレーション実行時の `DATABASE_URL` |

`packages/database/src/client.ts` は Neon serverless driver (`PrismaNeon` アダプタ)を使うため pooled 接続文字列を渡す。一方 `prisma migrate deploy` などの CLI コマンドは Prisma のマイグレーションエンジンが直接 TCP 接続するため、pooled 接続文字列(PgBouncer 経由)ではサポート外のプリペアドステートメント等でエラーになることがある。**マイグレーションには必ず direct 接続文字列を使うこと**。

## API Worker へのシークレット設定

本番の `apps/api` はシークレットを `wrangler.jsonc` に書かず、`wrangler secret put` で個別に登録する(`apps/api/wrangler.jsonc` のコメントに一覧あり)。

デプロイ対象の Worker は `wrangler.jsonc` の `env` で環境ごとに分かれており(`api-preview` / `api-production`)、シークレットの保存領域も Worker ごとに独立している。登録時は必ず `--env` で対象環境を指定すること。**`--env` を省略すると top-level の Worker `api` に登録され、デプロイされる `api-preview` / `api-production` からは一切参照されない**(top-level はローカル開発 `wrangler dev` 用で、ローカルはリモートのシークレットではなく `apps/api/.dev.vars` を読む)。

```bash
cd apps/api
pnpm exec wrangler secret put <NAME> --env preview      # preview 環境へ登録
pnpm exec wrangler secret put <NAME> --env production   # production 環境へ登録
```

全シークレットの具体的なコマンド一覧は後述の「CI からの自動デプロイ > 事前セットアップ」を参照。

非シークレットの値(`NODE_ENV`、`API_BASE_URL`、`WEB_BASE_URL`、`RESEND_FROM_EMAIL`)は `apps/api/wrangler.jsonc` の `vars` で管理する。デプロイ先の実際の URL に応じてプレースホルダ(`https://api.example.com` 等)を更新すること。

## 本番マイグレーション運用

`packages/database/prisma.config.ts` は `dotenv/config` 経由で `.env` を読むが、dotenv はデフォルトで**既存の `process.env` を上書きしない**。そのため CI やシェルから環境変数として `DATABASE_URL` を渡せば、`.env` ファイルの有無に関係なくその値が優先される。

```bash
DATABASE_URL="<Neon の direct 接続文字列>" \
  pnpm --filter @workspace/database db:migrate:deploy
```

運用上の注意:
- マイグレーションは**後方互換(additive)**を原則とする。デプロイ順序が「マイグレーション → Worker デプロイ」の場合、マイグレーション完了からデプロイ完了までの間は旧コードが新スキーマ上で動くため、カラム削除やリネームなど破壊的変更は避け、複数段階(追加 → 移行 → 削除)に分けること。
- `pnpm --filter @workspace/database db:migrate:status` で適用状況を事前確認できる。

## ステージング/プレビュー環境での Neon ブランチ活用(任意)

プレビュー環境を用意する場合、Neon のブランチ機能を使うと本番データのコピーオンライトブランチを低コストで作成できる。プレビュー用の Cloudflare Worker(例: `api-preview`)に対して、そのブランチの pooled 接続文字列を `wrangler secret put --env preview` で登録し、マイグレーションもブランチの direct 接続文字列を使って実行する。ブランチは検証後に削除して問題ない。

## CI からの自動デプロイ

`.github/workflows/deploy.yml` により、develop への push で `preview` 環境、main への push で `production` 環境へ自動デプロイされる(workflow_dispatch による手動実行も可能)。ジョブは checks(typecheck / test / api dry-run)→ migrate → deploy-api → deploy-web の順に直列実行される。

wrangler の環境は `apps/api/wrangler.jsonc` / `apps/web/wrangler.jsonc` の `env.preview` / `env.production` で定義しており、CI はジョブ環境変数 `CLOUDFLARE_ENV` で環境を選択する(wrangler は `--env` 未指定時にこの変数を参照する)。

Sentry の `environment` タグは `NODE_ENV` ではなく環境名(`preview` / `production`)で付与される。preview / production はどちらも `NODE_ENV=production` のため、api は `wrangler.jsonc` の各 env の `SENTRY_ENVIRONMENT`、web は CI がビルド時に注入する `NEXT_PUBLIC_SENTRY_ENVIRONMENT`(deploy.yml がデプロイ先環境名を自動で渡すため手動設定は不要)で識別する。これにより、Sentry 側のアラートルールを `environment:production` に絞れば preview のイベントは収集しつつ通知だけを本番に限定できる。

### 事前セットアップ

1. **GitHub Environments の作成**: リポジトリの Settings → Environments で `preview` と `production` を作成する。`production` には必要に応じて required reviewers(デプロイ承認)を設定できる。
2. **GitHub Secrets / Variables の登録**:

   | 名前 | 種別 | スコープ | 内容 |
   | :--- | :--- | :--- | :--- |
   | `CLOUDFLARE_API_TOKEN` | Secret | リポジトリ | Workers Scripts:Edit 権限を持つ API トークン |
   | `CLOUDFLARE_ACCOUNT_ID` | Secret | リポジトリ | デプロイ先の Cloudflare アカウント ID |
   | `DATABASE_URL` | Secret | Environment(preview / production 各々) | マイグレーション用の Neon **direct** 接続文字列 |
   | `NEXT_PUBLIC_API_URL` | Variable | Environment 各々 | web のビルド時にクライアントへインラインされる API URL |
   | `NEXT_PUBLIC_SENTRY_DSN` | Variable | Environment 各々 | 同上(未使用なら空文字) |

3. **Cloudflare 側のランタイムシークレット登録**: env 付き worker(`api-preview` / `api-production`)は top-level の `api` とは別 worker でシークレットも独立している。環境ごとに登録すること。

   ```bash
   cd apps/api

   # preview
   pnpm exec wrangler secret put DATABASE_URL --env preview          # Neon の pooled 接続文字列
   pnpm exec wrangler secret put AUTH_SECRET --env preview
   pnpm exec wrangler secret put RESEND_API_KEY --env preview
   pnpm exec wrangler secret put GOOGLE_CLIENT_ID --env preview
   pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET --env preview
   pnpm exec wrangler secret put APPLE_CLIENT_ID --env preview
   pnpm exec wrangler secret put APPLE_CLIENT_SECRET --env preview
   pnpm exec wrangler secret put SENTRY_DSN --env preview

   # production
   pnpm exec wrangler secret put DATABASE_URL --env production      # Neon の pooled 接続文字列
   pnpm exec wrangler secret put AUTH_SECRET --env production
   pnpm exec wrangler secret put RESEND_API_KEY --env production
   pnpm exec wrangler secret put GOOGLE_CLIENT_ID --env production
   pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET --env production
   pnpm exec wrangler secret put APPLE_CLIENT_ID --env production
   pnpm exec wrangler secret put APPLE_CLIENT_SECRET --env production
   pnpm exec wrangler secret put SENTRY_DSN --env production
   ```

### 役割分担の原則

- **GitHub Secrets**: CI がデプロイ・マイグレーションを実行するための資格情報のみ(`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` / migrate 用 `DATABASE_URL`)。
- **wrangler secret**: アプリのランタイムシークレットはすべてこちらで完結させ、CI を経由させない。

### ローカルからのデプロイはデフォルトでブロックされる

`pnpm run deploy`(api / web とも)は誤実行ガード(`scripts/ensure-ci-deploy.mjs`)により、CI 以外での実行をデフォルトで拒否する。checks / migrate を経ない野良デプロイ(例: シェルに `CLOUDFLARE_ENV=production` が残ったまま実行して本番を直接上書きする事故)を防ぐため。初回セットアップ等で意図的にローカルから実行する場合は `ALLOW_LOCAL_DEPLOY=1` を付ける:

```bash
ALLOW_LOCAL_DEPLOY=1 CLOUDFLARE_ENV=preview pnpm run deploy
```

### 初回デプロイ時の注意

- workers.dev サブドメインが未登録のアカウントでは、非対話の CI からの初回デプロイが失敗することがある。事前にダッシュボードで登録するか、初回のみローカルから手動デプロイする(上記の `ALLOW_LOCAL_DEPLOY=1` が必要)。
- web の `WORKER_SELF_REFERENCE` は自分自身への service binding のため、worker が存在しない初回デプロイで失敗する場合がある。その場合はワークフローを再実行する。
- 初回デプロイで workers.dev URL が確定したら、`wrangler.jsonc` の `vars`(`API_BASE_URL` / `WEB_BASE_URL` / `NEXT_PUBLIC_API_URL`)と GitHub Environment Variables を実際の URL に更新し、再デプロイする(`NEXT_PUBLIC_*` はビルド時インラインのため再ビルドが必須)。
