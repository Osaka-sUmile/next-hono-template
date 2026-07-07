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

```bash
cd apps/api
wrangler secret put DATABASE_URL          # Neon の pooled 接続文字列
wrangler secret put AUTH_SECRET
wrangler secret put RESEND_API_KEY
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put APPLE_CLIENT_ID
wrangler secret put APPLE_CLIENT_SECRET
wrangler secret put SENTRY_DSN
```

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
