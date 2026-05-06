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
