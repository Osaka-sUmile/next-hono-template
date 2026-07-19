# R2 ファイルアップロード導入レシピ

> このドキュメントは **重い画像・動画などのファイル保存が必要になったプロジェクト向けのレシピ**。
> テンプレート本体には実装コードを同梱していない。必要になった時点でこの手順に沿って都度実装する。
> 前提知識・環境変数の格納場所の考え方は [deployment.md](./deployment.md) と共通。

Cloudflare R2 は S3 互換のオブジェクトストレージで、egress 課金がない。api Worker から binding 経由で直接操作でき、S3 互換 API により presigned URL も発行できる。

## 全体像

保存対象(画像・動画等)は DB に置かず R2 に置き、DB にはオブジェクトキー(パス)のみを保存する、という分離が基本。アップロード経路は次の2方式があり、ファイルサイズと信頼境界で選ぶ。

| 方式 | 概要 | 向き | 注意 |
| :--- | :--- | :--- | :--- |
| Worker 経由(プロキシ) | クライアント → api Worker → `c.env.BUCKET.put()` | 小さいファイル、サーバ側で検証・変換したい場合 | Worker のリクエストサイズ・実行時間の上限を受ける。大きなファイルには不向き |
| presigned URL(推奨) | api Worker が署名付き URL を発行し、クライアントが R2 へ**直接** PUT/GET | 大きいファイル、動画など | 署名発行時にキー・Content-Type・有効期限を固定し、権限を最小化する |

ダウンロードも同様に、非公開バケットでは presigned GET URL を都度発行する(バケットは原則 public にしない)。

## セットアップ手順

環境ごとに**別バケット**を用意し、preview のデータが production に混ざらないようにする(Neon ブランチ・Worker 分離と同じ思想)。

### 1. バケットの作成(preview / production 分離)

```bash
cd apps/api

# 環境ごとに別バケットを作る(名前は衝突しない範囲で自由。例: <app>-uploads-<env>)
pnpm exec wrangler r2 bucket create myapp-uploads-preview
pnpm exec wrangler r2 bucket create myapp-uploads-production
```

バケットは原則 **public access を無効のまま**にする(配信は presigned URL か、必要なら別途 Custom Domain + アクセス制御で行う)。

### 2. `wrangler.jsonc` への binding 追加

R2 binding は **`vars` と同様に env に継承されない**ため、`apps/api/wrangler.jsonc` の top-level(ローカル開発用)・`env.preview`・`env.production` の**それぞれに定義する**。`bucket_name` を env ごとに手順1で作ったバケットへ向ける。

```jsonc
{
  // ... 既存の name / vars / ratelimits ...
  "r2_buckets": [
    { "binding": "UPLOADS_BUCKET", "bucket_name": "myapp-uploads-preview" }
  ],
  "env": {
    "preview": {
      // ... 既存の vars / ratelimits ...
      "r2_buckets": [
        { "binding": "UPLOADS_BUCKET", "bucket_name": "myapp-uploads-preview" }
      ]
    },
    "production": {
      // ... 既存の vars / ratelimits ...
      "r2_buckets": [
        { "binding": "UPLOADS_BUCKET", "bucket_name": "myapp-uploads-production" }
      ]
    }
  }
}
```

`binding` 名(`UPLOADS_BUCKET`)は全 env で揃える。コード側はこの名前だけを参照し、実バケットの差し替えは設定側で吸収する。

### 3. binding の型付け(env.ts)

R2 binding は環境変数(文字列)ではなく Worker bindings の一部なので、Zod の `envSchema`([apps/api/src/infrastructure/env.ts](../apps/api/src/infrastructure/env.ts))には載せず、`WorkerRateLimitBindings` と同様に**別の型**として扱う。

```typescript
// apps/api/src/infrastructure/env.ts に追記するイメージ
export type WorkerR2Bindings = {
  UPLOADS_BUCKET: R2Bucket;
};
```

`R2Bucket` / `R2Object` などの型は `@cloudflare/workers-types`(既存の型環境)で提供される。ハンドラでは検証済み `Env`(文字列群)と bindings(`UPLOADS_BUCKET` 等)を分けて受け取る。

### 4. presigned URL の発行(S3 互換 API)

R2 の S3 互換エンドポイントに対して署名を行う。R2 の **Access Key ID / Secret Access Key** は Cloudflare ダッシュボード(R2 → Manage R2 API Tokens)で発行し、**シークレット**として登録する([deployment.md](./deployment.md) の「Cloudflare ランタイムシークレット」と同じ流儀。`wrangler secret put ... --env <env>`)。

```bash
cd apps/api
pnpm exec wrangler secret put R2_ACCESS_KEY_ID --env preview
pnpm exec wrangler secret put R2_SECRET_ACCESS_KEY --env preview
# production も同様に --env production で登録
```

- 発行時にキー(保存パス)・`Content-Type`・**短い有効期限**(例: 5分)を固定し、それ以外の操作を許さない。
- キーはユーザーが指定した値をそのまま使わず、サーバ側で `uploads/<userId>/<uuid>.<ext>` のように**サーバ採番**する(パス・トラバーサルと衝突を防ぐ)。
- 署名生成は `aws4fetch` など軽量な Workers 互換ライブラリを使うと Node 依存を避けられる。

### 5. バケットの CORS 設定(presigned URL でブラウザから直接 PUT/GET する場合)

Worker 経由方式では不要だが、**presigned URL 方式でブラウザから R2 へ直接 `PUT`/`GET` する場合は、バケット側の CORS ルールが必須**(未設定だとブラウザがプリフライトで拒否する)。preview / production の web の実 origin ごとに許可する。

`apps/api` から環境ごとに適用する(バケットが別なので `--env` 相当としてバケット名で分ける)。

```bash
cd apps/api
pnpm exec wrangler r2 bucket cors put myapp-uploads-preview --rules ./r2-cors.preview.json
pnpm exec wrangler r2 bucket cors put myapp-uploads-production --rules ./r2-cors.production.json
```

ルール例(preview。production は `AllowedOrigins` を production の web origin に置換する):

```jsonc
[
  {
    // web の実 origin のみ許可する(ワイルドカードにしない)。deployment.md の WEB_BASE_URL と揃える。
    "AllowedOrigins": ["https://web-preview.<subdomain>.workers.dev"],
    // presigned PUT でアップロード、presigned GET でダウンロードする想定。
    "AllowedMethods": ["PUT", "GET"],
    // presigned PUT で Content-Type を固定するため許可する。必要に応じて追加。
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

- `AllowedOrigins` はワイルドカード(`*`)にせず、preview / production それぞれの web origin を明示する。
- `AllowedMethods` は実際に使うメソッドのみ(直 PUT + 直 GET なら `PUT` / `GET`)。
- `AllowedHeaders` には presigned URL で固定する `content-type` 等、クライアントが送るヘッダーを列挙する。

### 6. ローカル開発(wrangler dev の R2 シミュレーション)

`wrangler dev` はローカルの Miniflare で R2 をエミュレートするため、**実バケットなしで動作確認できる**。データはローカルの `.wrangler/state` 配下に保存される(gitignore 済みの前提)。

- Worker 経由方式(`c.env.UPLOADS_BUCKET.put/get`)はローカルでそのまま動く。
- presigned URL 方式は、署名先が実 R2 エンドポイントになるため、ローカルで直 PUT を試すには実バケット+ API トークンが必要。ローカルでは Worker 経由方式でロジックを確認し、presigned は preview で検証する、という切り分けが現実的。

## 命名規約とプレースホルダの流儀

既存 docs と揃える。

- binding 名は大文字スネークケース(例: `UPLOADS_BUCKET`)。全 env で同一。
- バケット名・アカウント固有値・URL などは `myapp-uploads-preview` / `example.com` のような**プレースホルダ**で書き、利用者が置換する前提を明記する。
- シークレット(`R2_ACCESS_KEY_ID` 等)は `wrangler.jsonc` に**書かない**。`wrangler secret put --env` で環境ごとに登録する([deployment.md](./deployment.md) 参照)。
- オブジェクトキーはサーバ採番の `uploads/<userId>/<uuid>.<ext>` を既定とし、公開バケットにしない。

## スコープ外

- 実装コード(コントローラー・ユースケース・フロント)のテンプレートへの同梱。必要になったプロジェクトが、このレシピと [CLAUDE.md](../CLAUDE.md) の実装フロー(Domain → Database → Application → Presentation → Frontend)に沿って実装する。
