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
- `fetch` をコンポーネント内に直接書かないこと。`apps/web/lib/` 配下に API クライアントを集約する。
- クライアント側からのバックエンド呼び出しは `apps/web/lib/api-client.ts` を経由すること（未作成の場合は新規作成する）。

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
