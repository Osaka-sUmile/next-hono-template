# 本番デプロイ・Neon 接続ガイド

> このドキュメントは **preview / production 環境を整備してデプロイする人**向け。
> ローカル開発を始めるだけなら本ドキュメントは不要で、README の「初期セットアップ手順」だけで完結する。

構成は次の通り。初めて環境を整備する場合は上から順に読めばよい。

1. [デプロイの全体像](#デプロイの全体像) — 何がどこにデプロイされ、CI がどう動くか
2. [セットアップ手順](#セットアップ手順) — 上から順に実施すれば環境整備が完了する
3. [環境変数リファレンス](#環境変数リファレンス) — 全変数の入手方法と格納場所の一覧
4. [補足: Neon の接続文字列が 2 種類ある理由](#補足-neon-の接続文字列が-2-種類ある理由)
5. [運用](#運用) — マイグレーション、デプロイガード、Neon ブランチ

## デプロイの全体像

### デプロイされる Worker

`wrangler.jsonc`(api / web とも)の `env` 定義により、環境ごとに**別々の Worker** としてデプロイされる。Worker が別なので、シークレットの保存領域も互いに独立している。

| Worker | 用途 | デプロイ契機 |
| :--- | :--- | :--- |
| `api-preview` / `web-preview` | preview 環境 | develop への push |
| `api-production` / `web-production` | production 環境 | main への push |
| `api` / `web`(top-level 設定) | ローカル開発(`wrangler dev`)専用 | デプロイしない |

### CI パイプライン

`.github/workflows/deploy.yml` が以下の順で直列実行する(workflow_dispatch による手動実行も可能)。

```text
checks (typecheck / test / api・web の dry-run ビルド)
  → migrate (prisma migrate deploy)
  → deploy-api
  → deploy-web
```

- wrangler の環境選択は CI がジョブ環境変数 `CLOUDFLARE_ENV` で行う(wrangler は `--env` 未指定時にこの変数を参照する)。
- Sentry の `environment` タグは `NODE_ENV` ではなく環境名(`preview` / `production`)で付与される。api は `wrangler.jsonc` の各 env の `SENTRY_ENVIRONMENT`、web は CI がビルド時に注入する `NEXT_PUBLIC_SENTRY_ENVIRONMENT` で識別する(いずれも手動設定は不要)。Sentry 側のアラートルールを `environment:production` に絞れば、preview のイベントは収集しつつ通知だけを本番に限定できる。

### 環境変数の格納場所と役割分担

格納場所は 4 種類あり、役割で使い分ける。

| 格納場所 | 役割 | 例 |
| :--- | :--- | :--- |
| GitHub Secrets / Variables | **CI がデプロイ・マイグレーションを実行するための値**と、**環境ごとの URL**(CI が `--var` / ビルド時 env で注入。唯一のソース) | `CLOUDFLARE_API_TOKEN`、migrate 用 `DATABASE_URL`、`API_BASE_URL` / `WEB_BASE_URL`、`NEXT_PUBLIC_*` |
| `wrangler secret put --env` | **アプリのランタイムシークレット**。CI を経由させずここで完結させる | ランタイム用 `DATABASE_URL`、`AUTH_SECRET` |
| `wrangler.jsonc` の `vars` | 非シークレットのランタイム設定(コミット対象)。環境ごとの URL はここには定義しない(CI が注入) | `NODE_ENV`、`RESEND_FROM_EMAIL` |
| ローカルファイル(`.dev.vars` / `.env.local` 等) | ローカル開発専用。デプロイには一切関与しない | README の初期セットアップ参照 |

なお、本番の API ランタイムと DB マイグレーションはどちらも `DATABASE_URL` という同じ名前の変数を使うが、**接続文字列の種類が異なる**([補足](#補足-neon-の接続文字列が-2-種類ある理由)参照)。

## セットアップ手順

以下を上から順に実施する。各値の具体的な入手方法は[環境変数リファレンス](#環境変数リファレンス)を参照。

### 1. workers.dev サブドメインの登録(未登録の場合)

Cloudflare ダッシュボード → Workers & Pages で workers.dev サブドメインを登録する。未登録だと非対話の CI からの初回デプロイが失敗することがある。

### 2. GitHub Environments の作成

リポジトリの Settings → Environments で `preview` と `production` を作成する。`production` には必要に応じて required reviewers(デプロイ承認)を設定できる。

`production` には **Deployment branches ルールを設定し、デプロイ元を `main` のみに制限すること**(Settings → Environments → `production` → Deployment branches and tags → Selected branches and tags → `main` を追加)。これにより、workflow_dispatch で他ブランチから production を選んで未マージのコードが本番へ出る事故を GitHub 側でブロックできる。deploy.yml の `resolve` ジョブでも同じ組み合わせを拒否しており、二段構えの防御になっている。

### 3. GitHub リポジトリ Secrets の登録

Settings → Secrets and variables → Actions → Secrets(リポジトリスコープ)に以下を登録する。環境共通の値なので Environment ではなくリポジトリ直下でよい。

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

### 4. Neon のプロビジョニングと DATABASE_URL の登録

1. [Neon Console](https://console.neon.tech/) でプロジェクトを作成する。
2. 環境ごとにブランチを分ける(例: `production` / `preview`)。Neon のブランチは Postgres のコピーオンライトブランチで、本番データに影響を与えずスキーマ検証ができる。
3. 各ブランチの接続文字列を **2 種類**取得し、それぞれ登録する:
   - **direct**(非 pooled)→ GitHub の各 Environment の Secret `DATABASE_URL` へ(マイグレーション用)
   - **pooled** → 手順 6 の `wrangler secret put DATABASE_URL --env <環境>` へ(API ランタイム用)

### 5. Cloudflare Turnstile ウィジェットの作成

email OTP の送信エンドポイント(送信・パスワードリセット)を分散ボットのメール乱用から守るため、better-auth の captcha プラグイン経由で Cloudflare Turnstile を使う(issue #41)。preview / production で別ウィジェット(別サイトキー)を作ることを推奨する。

1. Cloudflare ダッシュボード → **Turnstile** → **Add widget**。
2. Widget Mode は **Managed** を選択する(通常は非表示で、怪しいリクエストのみチェックボックスを表示する。UX と防御のバランスが良いため採用)。
3. Hostname に該当環境の web の実ドメイン(例: `web-preview.<subdomain>.workers.dev`)と、ローカル動作確認用に `localhost` を登録する。
4. 作成後に発行される **Site Key**(公開値)と **Secret Key**(秘匿値)を控える。Site Key は手順 7 の `NEXT_PUBLIC_TURNSTILE_SITE_KEY`、Secret Key は次の手順 6 の `TURNSTILE_SECRET_KEY` に使う。

ローカル開発・CI では、常にチャレンジが自動成功する Cloudflare の公式テストキー(Site Key: `1x00000000000000000000AA` / Secret Key: `1x0000000000000000000000000000000AA`)を使ってよい。`apps/api/.dev.vars.example` と `apps/web/.env.local.example` はこのテストキーで初期化済み。

### 6. Cloudflare ランタイムシークレットの登録

`api-preview` / `api-production` は別 Worker でシークレットも独立しているため、**必ず `--env` を付けて環境ごとに**登録する。**`--env` を省略すると top-level の Worker `api`(ローカル開発用)に登録され、デプロイされる Worker からは一切参照されない**。登録漏れがあってもデプロイは成功し、ランタイムエラーで発覚する点に注意。

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
pnpm exec wrangler secret put SENTRY_DSN --env preview           # Sentry を使わないなら登録不要(このコマンドは省略可)
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY --env preview # 手順 5 で発行した Secret Key

# production
pnpm exec wrangler secret put DATABASE_URL --env production      # Neon の pooled 接続文字列
pnpm exec wrangler secret put AUTH_SECRET --env production
pnpm exec wrangler secret put RESEND_API_KEY --env production
pnpm exec wrangler secret put GOOGLE_CLIENT_ID --env production
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET --env production
pnpm exec wrangler secret put APPLE_CLIENT_ID --env production
pnpm exec wrangler secret put APPLE_CLIENT_SECRET --env production
pnpm exec wrangler secret put SENTRY_DSN --env production         # 同上、省略可
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY --env production # 手順 5 で発行した Secret Key
```

### 7. GitHub Environment Variables の登録

Settings → Environments → 各環境の Variables に以下を登録する。URL 3 つは手順 8 で確定するため、それまでは仮値(`https://example.com` 等の非空文字列)で可。

- `API_BASE_URL`(api Worker 自身の URL)
- `WEB_BASE_URL`(web Worker の URL。API の CORS / better-auth の許可 origin に使われる)
- `NEXT_PUBLIC_API_URL`(api Worker の URL。web のクライアントバンドルにインラインされる)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`(手順 5 で発行した Site Key)
- `NEXT_PUBLIC_SENTRY_DSN`(Sentry を使わないなら空文字)

`API_BASE_URL` / `WEB_BASE_URL` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` が未設定のままだと該当デプロイジョブがデプロイ前に失敗する(プレースホルダ URL のままデプロイされ、CORS が全リクエストを拒否する事故等を防ぐため)。

### 8. 初回デプロイ

develop へ push すると preview 環境へ自動デプロイされる。CI を待たずに確認したい場合はローカルから手動でも実行できる(通常はガードによりブロックされるため `ALLOW_LOCAL_DEPLOY=1` が必要)。GitHub Secrets はローカルシェルには渡らないため、事前に `pnpm exec wrangler login` で認証するか、`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` をローカル環境変数として設定しておくこと。CI と同じく **api → web の順**に、両方デプロイすること:

```bash
cd apps/api
ALLOW_LOCAL_DEPLOY=1 CLOUDFLARE_ENV=preview pnpm run deploy

cd ../web
ALLOW_LOCAL_DEPLOY=1 CLOUDFLARE_ENV=preview pnpm run deploy
```

workers.dev の URL は `https://<Worker 名>.<アカウントのサブドメイン>.workers.dev` という固定の形式のため、初回デプロイでサブドメインが分かれば **preview / production 両方の URL が確定する**。例えばサブドメインが `example-team` なら:

| Worker | URL |
| :--- | :--- |
| `api-preview` | `https://api-preview.example-team.workers.dev` |
| `web-preview` | `https://web-preview.example-team.workers.dev` |
| `api-production` | `https://api-production.example-team.workers.dev` |
| `web-production` | `https://web-production.example-team.workers.dev` |

既知の初回のみの失敗パターン:

- web の `WORKER_SELF_REFERENCE` は自分自身への service binding のため、Worker が存在しない初回デプロイで失敗する場合がある。その場合はワークフローを再実行する。

### 9. URL の反映と再デプロイ

手順 8 で確定した URL を **GitHub Environment Variables(手順 7 の仮値)** に反映し、再デプロイする。**preview の URL は Environment `preview` へ、production の URL は Environment `production` へ**設定する(末尾スラッシュなし)。

| 変数 | 設定する値 |
| :--- | :--- |
| `API_BASE_URL` / `NEXT_PUBLIC_API_URL` | api Worker の URL(例: `https://api-preview.<subdomain>.workers.dev`) |
| `WEB_BASE_URL` | web Worker の URL(例: `https://web-preview.<subdomain>.workers.dev`) |

環境ごとの URL のソースはこの GitHub Environment Variables のみ。`wrangler.jsonc` の `env.preview` / `env.production` には URL 系の `vars` は定義されておらず、CI が `wrangler deploy --var` で注入する。

再デプロイは GitHub Actions の Run を re-run するか、workflow_dispatch で手動実行する。`NEXT_PUBLIC_*` はビルド時にクライアントバンドルへインラインされるため、値の変更にはビルドからやり直す再デプロイが必須。

### 10. 動作確認

デプロイされた web からログイン等の API 通信ができること、Turnstile ウィジェットが表示・自動パスすること、(Sentry 利用時は)エラーが正しい `environment` タグで届くことを確認する。

## 環境変数リファレンス

デプロイに関わる全変数の一覧。この表を上から埋めていけば設定漏れがない状態になる。

### GitHub 側に登録するもの

| 変数名 | 値の入手方法 | 格納場所 | 環境ごとに別の値? |
| :--- | :--- | :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | ダッシュボード右上のアイコン → My Profile → API Tokens → Create Token → テンプレート「**Edit Cloudflare Workers**」を選択(Account Resources は対象アカウントのみに絞る) | リポジトリ Secret | いいえ(共通) |
| `CLOUDFLARE_ACCOUNT_ID` | ダッシュボード → Workers & Pages の右サイドバーに表示される Account ID | リポジトリ Secret | いいえ(共通) |
| `DATABASE_URL` | Neon Console → 対象ブランチ → Connect で **Connection pooling を OFF** にした接続文字列(ホスト名に `-pooler` が付かない = direct) | Environment Secret | はい |
| `API_BASE_URL` | 初回デプロイ後に確定する api Worker の URL(例: `https://api-preview.<subdomain>.workers.dev`)。**末尾スラッシュなし**。CI が `wrangler deploy --var` で api Worker に注入する | Environment Variable | はい |
| `WEB_BASE_URL` | 初回デプロイ後に確定する web Worker の URL(例: `https://web-preview.<subdomain>.workers.dev`)。**末尾スラッシュなし**。API の CORS / better-auth の許可 origin に使われる | Environment Variable | はい |
| `NEXT_PUBLIC_API_URL` | `API_BASE_URL` と同じ値(api Worker の URL)。web のビルド時にクライアントバンドルへインラインされる | Environment Variable | はい |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | 手順 5 で作成した Turnstile ウィジェットの Site Key。web のビルド時にクライアントバンドルへインラインされる | Environment Variable | はい |
| `NEXT_PUBLIC_SENTRY_DSN` | [sentry.io](https://sentry.io) → web 用プロジェクト(Platform: Next.js)→ Settings → Client Keys (DSN)。**使わないなら空文字で可** | Environment Variable | はい(共通でも可) |

### Cloudflare 側に登録するもの(`wrangler secret put <NAME> --env <preview|production>`)

| 変数名 | 値の入手方法 | 環境ごとに別の値? |
| :--- | :--- | :--- |
| `DATABASE_URL` | Neon Console → 対象ブランチ → Connect で **Connection pooling を ON** にした接続文字列(ホスト名に `-pooler` が付く = pooled) | はい |
| `AUTH_SECRET` | 自分で生成する: `openssl rand -base64 32`。**ローカル・preview・production すべて別の値**にすること(漏洩時の影響を分離するため) | はい |
| `RESEND_API_KEY` | [Resend](https://resend.com) → API Keys → Create API Key(Permission は最小権限の **Sending access** を選択) | はい(共通でも可) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console → APIs & Services → Credentials → OAuth クライアント ID を作成。リダイレクト URI に `{API の URL}/api/auth/callback/google` を登録 | 環境ごとに分けるのを推奨 |
| `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET` | Apple Developer → Certificates, Identifiers & Profiles で Services ID と秘密鍵を作成。コールバックは `{API の URL}/api/auth/callback/apple` | 環境ごとに分けるのを推奨 |
| `SENTRY_DSN` | [sentry.io](https://sentry.io) → api 用プロジェクト(Platform: Cloudflare Workers)→ Settings → Client Keys (DSN)。**使わないなら登録しなくてよい** | はい(共通でも可) |
| `TURNSTILE_SECRET_KEY` | 手順 5 で作成した Turnstile ウィジェットの Secret Key。**必須**(未設定だと env.ts の Zod 検証で API 起動時に失敗する) | 環境ごとに分けるのを推奨 |

### `wrangler.jsonc` の `vars` で管理するもの(コミット対象・非シークレット)

| 変数名 | 値の入手方法 | 場所 |
| :--- | :--- | :--- |
| `RESEND_FROM_EMAIL` | Resend でドメイン検証(Domains → Add Domain)した送信元アドレスを自分で決める | `apps/api/wrangler.jsonc` の各 env の `vars` |

環境ごとの URL(`API_BASE_URL` / `WEB_BASE_URL` / `NEXT_PUBLIC_*`)は `wrangler.jsonc` には定義しない。デプロイ環境の実値は GitHub Environment Variables を唯一のソースとして CI が `--var` で注入し(上の「GitHub 側に登録するもの」参照)、ローカル実行(`wrangler dev` / `pnpm preview`)は `.dev.vars` をソースとする。

### `wrangler.jsonc` の `ratelimits` で管理するもの(コミット対象・シークレット不要)

Cloudflare Workers Rate Limiting binding(issue #41)。認証系のメール送信・サインイン・パスワードリセットエンドポイントを対象に、単一 IP からの高速な試行を防ぐ。シークレットではなく `apps/api/wrangler.jsonc` の top-level / `env.preview` / `env.production` に直接コミットされており、追加の登録作業は不要。

| 設定項目 | 内容 |
| :--- | :--- |
| `name` | binding 名(`AUTH_RATE_LIMITER`)。コード側の参照名と一致させる |
| `namespace_id` | Cloudflare アカウント内で一意な正の整数。環境間でカウンターが混ざらないよう env ごとに別の値を割り当てている |
| `simple.limit` / `simple.period` | 上限リクエスト数 / 期間(秒)。`period` は 10 か 60 のみ指定可能 |

binding は colo 単位の eventual consistent な近似カウントであり、in-memory store と異なり複数インスタンス間でも共有される。

### 設定不要(自動供給されるもの)

| 変数名 | 供給元 |
| :--- | :--- |
| `NODE_ENV` | `wrangler.jsonc` の `vars` に定義済み |
| `SENTRY_ENVIRONMENT` | `apps/api/wrangler.jsonc` の各 env の `vars` に定義済み |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | CI(deploy.yml)がデプロイ先環境名をビルド時に自動注入 |
| `CLOUDFLARE_ENV` | CI(deploy.yml)がジョブ環境変数として自動設定 |

## 補足: Neon の接続文字列が 2 種類ある理由

Neon はプールされた接続とプールされていない接続の 2 種類の接続文字列を提供する。**用途によって使い分けが必須**。

| 種類 | ホスト名の特徴 | 用途 | 使用箇所 |
| :--- | :--- | :--- | :--- |
| pooled | `-pooler` サフィックスあり | Neon serverless driver (`@neondatabase/serverless` + `@prisma/adapter-neon`) 経由の接続 | API Worker ランタイムの `DATABASE_URL` (`wrangler secret put`) |
| direct (non-pooled) | `-pooler` サフィックスなし | prisma CLI (`prisma migrate` 等) が Node/TCP で直接接続する経路 | マイグレーション実行時の `DATABASE_URL` |

`packages/database/src/client.ts` は Neon serverless driver (`PrismaNeon` アダプタ)を使うため pooled 接続文字列を渡す。一方 `prisma migrate deploy` などの CLI コマンドは Prisma のマイグレーションエンジンが直接 TCP 接続するため、pooled 接続文字列(PgBouncer 経由)ではサポート外のプリペアドステートメント等でエラーになることがある。**マイグレーションには必ず direct 接続文字列を使うこと**。

## 運用

### 本番マイグレーション

CI の `migrate` ジョブが GitHub Environment Secret の `DATABASE_URL`(direct)を使って `prisma migrate deploy` を自動実行する。手動で実行する場合:

```bash
DATABASE_URL="<Neon の direct 接続文字列>" \
  pnpm --filter @workspace/database db:migrate:deploy
```

`packages/database/prisma.config.ts` は `dotenv/config` 経由で `.env` を読むが、dotenv はデフォルトで**既存の `process.env` を上書きしない**。そのため CI やシェルから環境変数として `DATABASE_URL` を渡せば、`.env` ファイルの有無に関係なくその値が優先される。

運用上の注意:

- マイグレーションは**後方互換(additive)**を原則とする。デプロイ順序が「マイグレーション → Worker デプロイ」のため、マイグレーション完了からデプロイ完了までの間は旧コードが新スキーマ上で動く。カラム削除やリネームなど破壊的変更は避け、複数段階(追加 → 移行 → 削除)に分けること。
- `migrate` 成功後に `deploy-api` / `deploy-web` が失敗した場合、「新スキーマ + 旧コード」の状態で止まる。マイグレーションが後方互換であれば旧コードはそのまま動き続けるため、慌てて切り戻す必要はない。失敗原因を解消したうえで、GitHub Actions の該当 Run から失敗ジョブを re-run すれば復旧する(適用済みのマイグレーションは `prisma migrate deploy` が冪等にスキップする)。
- `pnpm --filter @workspace/database db:migrate:status` で適用状況を事前確認できる。

### ローカルからのデプロイはデフォルトでブロックされる

`pnpm run deploy`(api / web とも)は誤実行ガード(`scripts/ensure-ci-deploy.mjs`)により、CI 以外での実行をデフォルトで拒否する。checks / migrate を経ない野良デプロイ(例: シェルに `CLOUDFLARE_ENV=production` が残ったまま実行して本番を直接上書きする事故)を防ぐため。

デプロイは CI 経由が原則で、ローカルから実行するのは初回セットアップ(セットアップ手順 8)等に限る。意図的に実行する場合のみ `ALLOW_LOCAL_DEPLOY=1` を付ける:

```bash
ALLOW_LOCAL_DEPLOY=1 CLOUDFLARE_ENV=preview pnpm run deploy
```

注意: 環境ごとの URL(`API_BASE_URL` / `WEB_BASE_URL` / `NEXT_PUBLIC_*`)は CI が GitHub Environment Variables から注入するため、ローカルから上記コマンドだけで実行すると URL 系の vars が未定義のままデプロイされる(api は `env.ts` の Zod default である localhost にフォールバックし、CORS が実オリジンを拒否する)。ローカルからデプロイする場合は、CI と同様に実値を渡すこと:

```bash
# api の例 (--var で wrangler に渡す。サーバーの実行時 env なのでこれで十分)
ALLOW_LOCAL_DEPLOY=1 CLOUDFLARE_ENV=preview pnpm run deploy \
  --var "API_BASE_URL:https://api-preview.<subdomain>.workers.dev" \
  --var "WEB_BASE_URL:https://web-preview.<subdomain>.workers.dev"
```

```bash
# web の例。NEXT_PUBLIC_API_URL はデプロイ前の `next build` でクライアントバンドルへ
# インラインされるため、--var (wrangler deploy 時のみ有効) では手遅れ。
# `pnpm run deploy` 実行前のシェル環境変数として渡すこと。
ALLOW_LOCAL_DEPLOY=1 CLOUDFLARE_ENV=preview \
NEXT_PUBLIC_API_URL="https://api-preview.<subdomain>.workers.dev" \
NEXT_PUBLIC_SENTRY_DSN="" \
  pnpm run deploy --var "NEXT_PUBLIC_API_URL:https://api-preview.<subdomain>.workers.dev"
```

### ステージング/プレビュー環境での Neon ブランチ活用(任意)

Neon のブランチ機能を使うと、本番データのコピーオンライトブランチを低コストで作成できる。プレビュー用 Worker(`api-preview`)にそのブランチの pooled 接続文字列を `wrangler secret put DATABASE_URL --env preview` で登録し、マイグレーションもブランチの direct 接続文字列で実行する。ブランチは検証後に削除して問題ない。
