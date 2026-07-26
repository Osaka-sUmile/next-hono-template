# フロントエンド開発ガイドライン (apps/web)

## フォルダ構成
- `app/` : Next.js App Router のページ (`page.tsx`) とレイアウト (`layout.tsx`) のみ置く。
- `components/` : `ThemeProvider` 等、アプリ固有の設定・ラッパーコンポーネントのみ。汎用 UI 部品は `packages/ui` へ。
- `hooks/` : アプリ固有の React Hooks。
- `lib/` : API クライアントやユーティリティ。

## コンポーネントの追加
- `packages/ui` への新規 UI コンポーネント追加は `pnpm dlx shadcn add <name> --cwd packages/ui` で行うこと。手動でファイルを直接作成しない。
- アプリ固有のラッパーが必要な場合のみ `apps/web/components/` に追加する。

## インポートルール
`packages/ui` からのインポートは公開エントリーポイント経由のみ。

| 対象 | インポートパス |
| :--- | :--- |
| コンポーネント | `@workspace/ui/components/<name>` |
| ユーティリティ | `@workspace/ui/lib/utils` |
| グローバル CSS | `@workspace/ui/globals.css` |

`@workspace/ui/src/**` への深いインポートは禁止（ESLint で自動検出）。

## スタイリング
- 色は CSS 変数トークンを使うこと（`bg-primary`, `text-muted-foreground` 等）。ハードコード色（`text-red-500`, `bg-[#fff]` 等）は禁止。
- デザイントークンの定義は `packages/ui/src/styles/globals.css` に集約する。新規トークンもここに追加する。
- インラインスタイル（`style={{ ... }}`）は使用禁止。Tailwind クラスで対応する。

## Server Components / Client Components
- デフォルトは Server Component。`useState` / `useEffect` / ブラウザ API が必要な場合のみ `"use client"` を付与する。
- `"use client"` はファイルの先頭行に置くこと。

## データフェッチ・API 呼び出し
- `fetch` をコンポーネント内に直接書かないこと。バックエンド呼び出しは `apps/web/lib/api-client.ts` を経由する。
- better-auth のエンドポイントは `authClient`（`apps/web/lib/auth-client.ts`）が担当するため、この規約の対象外。

### api-client が引き受けること

`apiClient` は [openapi-fetch](https://github.com/openapi-ts/openapi-typescript) を内部で使うアダプター。`paths` は `apps/api/openapi.json`（API の OpenAPI ドキュメント）から `openapi-typescript` が生成した型（`apps/web/lib/api-schema.d.ts`）で、パス・メソッド・リクエスト/レスポンスの形が API の実装と自動で一致する（詳細は `docs/architecture.md`「API 型の共有方針」）。

`apiClient.get / post / put / patch / delete` を使うと、以下が自動で付く。呼び出し側で書き直さないこと。
第 2 引数には OpenAPI 定義に応じて `body` と `params`（`query` / `path` / `header` / `cookie`）を渡せ、必須・任意も生成型から決まる。

| 項目 | 内容 |
| :--- | :--- |
| ベース URL | `apiBaseUrl`（`NEXT_PUBLIC_API_URL`）を前置する |
| 認証 | `credentials: "include"`。Cookie セッション認証に必須で、落とすと原因の分かりにくい 401 になる |
| ヘッダー | body があるとき `Content-Type: application/json` |
| 型 | パスごとの request/response の型が `openapi-typescript` の生成物から効く |

openapi-fetch 固有の uppercase メソッドと `{ data, error, response }` は api-client 内部に閉じ込める。公開メソッドは成功時に型付けされたレスポンスを直接返し、2xx 以外では `status` を保持する `ApiError` を throw する。

```typescript
import { ApiError, apiClient } from "@/lib/api-client";

const user = await apiClient.get("/api/v1/me");
await apiClient.patch("/api/v1/me", { body: { displayName: "太郎" } });
```

### 想定内かどうかの判断は呼び出し側に置く

api-client は「4xx は全部想定内」とは決めない。それを決めると `reportError` の fail-loud 原則（後述）に反し、観測漏れを生むため。`status` を見て `ExpectedError` に包み替えるかは呼び出し側が判断する。

```typescript
import { ApiError, apiClient } from "@/lib/api-client";
import { ExpectedError, reportError } from "@/lib/report-error";

try {
  await apiClient.patch("/api/v1/me", { body: { displayName } });
} catch (error) {
  // このエンドポイントでは 400 / 401 がユーザー操作で当然起きうるので想定内扱いにする。
  if (error instanceof ApiError && (error.status === 400 || error.status === 401)) {
    reportError(new ExpectedError(error.message));
  } else {
    reportError(error);
  }
  setError("更新に失敗しました。");
}
```

実装見本は `apps/web/components/display-name-form.tsx`。

### API のルート定義を変更したら

`apps/api/src/presentation/routes/` の Zod スキーマを変更したら、以下を実行して生成物を再生成し、`apps/api/openapi.json` と `apps/web/lib/api-schema.d.ts` の両方をコミットする。忘れると CI（`.github/workflows/lint.yml`）の差分チェックで落ちる。

```bash
pnpm run openapi:generate
```

## エラーハンドリング・Sentry

### Sentry が自動捕捉する経路

Sentry が自動でエラーを拾うのは以下2経路のみ：

1. **グローバルハンドラ**（`instrumentation-client.ts`）— `window.onerror` / `unhandledrejection` 経由で、どこにも catch されなかった例外を捕捉する。
2. **React Error Boundary**（`app/error.tsx` / `app/global-error.tsx`）— レンダリング中に throw され境界まで伝播した例外を `captureException` で捕捉する。

`try/catch` で握りつぶした（再 throw しない）エラーはどちらにも届かず、Sentry に記録されない。

### ルール：catch 節では必ず reportError を呼ぶ

```typescript
import { reportError, ExpectedError } from "@/lib/report-error";

try {
  await someAsyncOperation();
} catch (error) {
  reportError(error); // 必ず呼ぶ。想定内エラー以外は自動で Sentry に送信される。
  setError("エラーが発生しました。");
}
```

### 想定内エラーの抑制

ユーザー操作で当然起きうるエラー（認証コード不一致、未ログイン等）のみ `ExpectedError` で印を付け、Sentry 送信を抑制する。

```typescript
// 呼び出し側が想定内と判断できる場合
throw new ExpectedError("OTP mismatch");

// catch 側では reportError をそのまま呼ぶだけでよい（判定は reportError が行う）
```

### Fail-loud の原則

`reportError` はデフォルトで「送る」に倒れる設計（fail-loud）。判断に迷うものは印を付けずそのまま渡すこと。送りすぎはノイズ増（気づける）で済むが、送らなすぎは観測漏れ（静かなバグ）になる。

### better-auth の { error } について

`authClient.xxx()` が返す `{ error }` はコード不一致・送信失敗等の想定内ビジネスエラーのため、UI 通知のみで `reportError` は不要。
