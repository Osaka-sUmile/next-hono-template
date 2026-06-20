# yomutan 開発ガイドライン (Actionable Rules)

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

## エラーコードの追加手順
エラーコードを追加する際は、以下の **3 箇所を同時に更新** すること。順序を守り、どちらか一方だけの更新を防ぐ。

1. **`apps/api/src/presentation/error-codes.ts`** - ErrorCodes 定数オブジェクトに追加
   ```typescript
   RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
   ```

2. **`apps/api/src/presentation/error-codes.ts`** - ErrorCode 型に union を追加
   ```typescript
   export type ErrorCode = "USER_NOT_FOUND" | ... | "RESOURCE_NOT_FOUND";
   ```

3. **`apps/api/docs/components/schemas/Error.yaml`** - enum に追加
   ```yaml
   enum:
     - USER_NOT_FOUND       # User-related errors
     - RESOURCE_NOT_FOUND   # Resource-related errors
   ```

**理由**: 型定義とドキュメントが同期していないと、クライアント実装が破綻する。CI で enum の一致を検証することを推奨。

**チェックリスト**: エラーコード追加時は以下を確認すること
- [ ] `error-codes.ts` の ErrorCodes 定数に追加されている
- [ ] `error-codes.ts` の ErrorCode 型に union として追加されている  
- [ ] `Error.yaml` の enum に同じコード（大文字スネークケース）で追加されている
- [ ] エラーレスポンスのキー名が `error` であることを確認（OpenAPI スキーマ Error.yaml と一致）

## エラーコード追加のブランチ戦略
エラーコードを追加する際は、必ず `develop` から専用ブランチを派生させて PR を作成すること。フィーチャーブランチへの同梱は禁止。

```text
# 例
develop
  └── chore/add-post-error-codes  ← 別にブランチを分ける
  └── feat/post
```

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
