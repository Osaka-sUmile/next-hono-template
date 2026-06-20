# アーキテクチャ概要

## 依存関係のルール
- 依存の向きは必ず「外側 -> 内側」へ向かうこと。`packages/domain` は他を import 禁止。

## DI (Dependency Injection) 戦略
- 複雑なDIコンテナは不使用。「Pure DI (手動コンストラクタ注入)」を徹底すること。

## API の構成レイヤー
- `apps/api/src/infrastructure/`: 環境変数、Swagger 設定、Prisma などの基盤処理。
- `apps/api/src/composition/`: Application / Presentation / Infrastructure を束ねる起動配線。

## 起動シーケンスのポリシー
- Swagger (`setupSwagger`) は **fail-fast**。OpenAPI YAML の読み込みに失敗した場合はサーバを起動しない（`process.exit(1)`）。
- 配布時の OpenAPI YAML パスは `OPENAPI_PATH` で上書き可能。未指定時は `apps/api/docs/openapi.yaml` を実行ファイル相対で解決する（Docker 配布では `OPENAPI_PATH` を明示推奨）。

## バリデーションの境界
| 種類 | 実行場所 | 目的 |
| :--- | :--- | :--- |
| 入力検証 | Presentation | 不正なリクエストの弾き (Zod) |
| ビジネス検証 | Domain | ルール違反の防止 (Entityメソッド) |

## 📂 フォルダ構造

```
my-app/
├── apps/
│   ├── api/                          # Express バックエンド
│   │   ├── docs/                     # OpenAPI 定義 (YAML)
│   │   │   ├── components/schemas/
│   │   │   └── paths/
│   │   └── src/
│   │       ├── index.ts              # エントリーポイント (bootstrap)
│   │       ├── application/          # ユースケース層 (CQRS)
│   │       │   ├── commands/         # 副作用あり (Command UseCase)
│   │       │   └── queries/          # 参照のみ (Query UseCase)
│   │       ├── composition/          # DI 配線・アプリ組み立て
│   │       ├── infrastructure/       # env, Swagger 等の基盤
│   │       ├── presentation/
│   │       │   ├── controllers/      # コントローラー・リクエスト検証
│   │       │   └── middleware/       # 認証・認可ミドルウェア
│   │       └── test-utils/           # テスト共通ヘルパー
│   └── web/                          # Next.js フロントエンド
│       ├── app/                      # App Router (page / layout)
│       ├── components/               # アプリ固有ラッパー (ThemeProvider 等)
│       ├── hooks/                    # アプリ固有 React Hooks
│       ├── lib/                      # API クライアント・ユーティリティ
│       └── tests/e2e/                # Playwright E2E テスト
├── packages/
│   ├── auth/                         # 認証 SDK（better-auth ラッパー）
│   │   └── src/
│   │       ├── server.ts             # createAuth() + toNodeHandler
│   │       ├── client.ts             # createClient()
│   │       └── index.ts              # 共通型 re-export
│   ├── domain/                       # ドメイン層（外部依存ゼロ）
│   │   └── src/
│   │       ├── models/               # エンティティ・値オブジェクト
│   │       └── repositories/         # リポジトリインターフェース
│   ├── database/                     # DB 層 (Prisma リポジトリ実装)
│   │   ├── prisma/schema.prisma
│   │   └── src/
│   │       ├── client.ts             # PrismaClient ファクトリ
│   │       ├── repositories/         # IRepository 実装 (Command)
│   │       └── query-services/       # 読み取り専用クエリ (Query)
│   ├── ui/                           # 汎用 UI コンポーネント (shadcn/ui)
│   │   └── src/
│   │       ├── components/           # Button 等の汎用コンポーネント
│   │       ├── hooks/
│   │       ├── lib/utils.ts          # cn() 等のユーティリティ
│   │       └── styles/globals.css    # Tailwind + デザイントークン
│   ├── eslint-config/                # 共有 ESLint 設定
│   └── typescript-config/            # 共有 tsconfig
├── docs/
│   ├── architecture.md               # 本ファイル
│   └── frontend-guidelines.md        # フロントエンド開発ガイドライン
├── CLAUDE.md                         # AI エージェント向け開発ガイドライン
├── docker-compose.yml
├── turbo.json
└── package.json
```

### パッケージ間の依存関係

```
apps/web        →  packages/ui
                →  packages/auth (client)
apps/api        →  packages/domain
                →  packages/database
                →  packages/auth (server)
packages/auth   →  better-auth, resend (外部ライブラリ)
packages/database  →  packages/domain
```

`packages/domain` は最内層のため、他パッケージへの依存は一切禁止。
`packages/auth` は `packages/database` に依存しない。PrismaClient は `apps/api/src/composition/` から注入する。

## 📂 将来のフォルダ拡張ルール (Project Map)
新しいフォルダを作成する際はここに従うこと。勝手な階層は作らない。
- `packages/domain/`: `errors/`, `services/`, `value-objects/`
- `packages/database/`: `repositories/` (Command用マッパー), `mappers/` (共通マッパーが必要な場合), `query-services/` (Read用)
- `apps/api/src/application/`: `dtos/`, `errors/`
- `apps/api/src/infrastructure/`: `env/`, `swagger/`, `db/`
- `apps/api/src/composition/`: `create-app/`, `bootstrap/`
- `apps/api/src/presentation/`: `middleware/`
- `packages/common/`: `utils/`, `types/`

## tests の配置ルール
- Vitest は co-located な `*.test.ts` / `*.test.tsx` を採用する。
- Playwright は `apps/web/tests/e2e/` に集約する。

## components の責務
- `packages/ui/`: 汎用 UI 部品のみ。
- `apps/web/components/`: theme provider などのアプリ固有コンポーネント・設定。

## 🏷 命名規則
- **Entities**: `*.entity.ts`
- **Value Objects**: `*.value-object.ts`
- **Repositories**: `*.repository.ts` (Interface) / `*.prisma-repository.ts` (Impl)
- **Use Cases**: `*.use-case.ts`
- **Controllers**: `*.controller.ts`
- **Query Services**: `*.query-service.ts`