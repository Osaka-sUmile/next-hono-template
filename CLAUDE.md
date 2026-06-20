# 開発ガイドライン (Actionable Rules)

## 実装フロー (Feature Implementation Flow)
新規機能追加時は以下の順序で作成すること。
1. **Domain (packages/domain)**: エンティティ・リポジトリインターフェース (`*.entity.ts`, `*.repository.ts`)
2. **Database (packages/database)**: リポジトリ実装・クエリサービス (`*.prisma-repository.ts`, `*.query-service.ts`)
3. **Application (apps/api/src/application)**: ユースケース (`*.use-case.ts`) (Command / Query を分離し、Command は副作用あり、Query は参照のみ)
4. **Presentation (apps/api/src/presentation)**: リクエストバリデーション(Zod)・コントローラー (`*.controller.ts`)

## CQRS の使い分け
- **Command**: 副作用ありの処理。必要なら UseCase 内で `prisma.$transaction` を張る。
- **Query**: 参照のみの処理。原則として読み取り専用 DTO を返し、Entity の復元は必須ではない。

## DTO / エラーの責務
- **Request DTO**: Presentation で Zod から生成する。
- **Response DTO**: Application で組み立てる。
- **Domain Error / Application Error**: `apps/api/src/application/errors/` に集約し、Presentation で HTTP エラーへ変換する。

## テスト配置
- **Vitest**: 実装と同じ階層に `*.test.ts` / `*.test.tsx` を co-located で置く。
- **Playwright**: `apps/web/tests/e2e/` に集約する。
- **テスト共通ユーティリティ**: `<app>/src/test-utils/` に集約し、`__tests__/helpers/` 等の独自階層は作らない。

## apps/web のルール
- フロントエンドの詳細ガイドライン（フォルダ構成・コンポーネント追加・スタイリング・Server/Client Components・API 呼び出し）は `docs/frontend-guidelines.md` を参照すること。

## バリデーション境界
- **入力 (Presentation)**: Zodで型と形式を検証。
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
