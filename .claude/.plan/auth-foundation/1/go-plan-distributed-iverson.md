# better-auth フルスタック認証基盤 実装プラン

## Context

このリポジトリにbetter-authを用いた認証基盤を組み込む。「packages/auth を共有SDKパッケージとして分離する」方針に基づく。

- **認証方式**: Google OAuth, Apple OAuth, Email OTP (Resend)
- **セッション**: Cookie ベース (better-auth デフォルト)
- **User テーブル**: better-auth の User テーブルに `role` + `displayName` を additionalFields で同居
- **Domain Entity**: better-auth の User と同じ id を共有する `UserEntity` を packages/domain に定義
- **スコープ**: packages/auth の作成から apps/web の authClient まで

---

## 完成後のディレクトリ構造（新規・更新ファイルのみ）

```
yomutan/
├── packages/
│   ├── auth/                              # ★ 新規パッケージ
│   │   ├── src/
│   │   │   ├── server.ts                 # createAuth() + toNodeHandler re-export
│   │   │   ├── client.ts                 # createClient()
│   │   │   └── index.ts                  # 共通型 re-export
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── eslint.config.mjs             # ★ @workspace/eslint-config を使用
│   ├── domain/
│   │   └── src/
│   │       ├── models/
│   │       │   ├── user.entity.ts        # ★ 新規
│   │       │   └── index.ts              # ★ 更新
│   │       ├── repositories/
│   │       │   ├── user.repository.ts    # ★ 新規 (IUserRepository)
│   │       │   └── index.ts              # ★ 更新
│   │       ├── services/                 # ★ 新規ディレクトリ
│   │       │   ├── user.query-service.ts # IUserQueryService + UserQueryResult
│   │       │   └── index.ts
│   │       └── index.ts                  # ★ 更新
│   └── database/
│       ├── prisma/
│       │   └── schema.prisma             # ★ 更新 (4モデル追加)
│       └── src/
│           ├── repositories/
│           │   ├── user.prisma-repository.ts  # ★ 新規
│           │   └── index.ts              # ★ 更新
│           ├── query-services/
│           │   ├── user.query-service.ts # ★ 新規
│           │   └── index.ts              # ★ 更新
│           └── index.ts                  # ★ 更新
├── apps/
│   ├── api/
│   │   ├── docs/
│   │   │   ├── openapi.yaml              # ★ 更新 (/me path & cookieAuth scheme 追加)
│   │   │   ├── components/schemas/
│   │   │   │   └── User.yaml             # ★ 更新 (role/displayName/emailVerified/image/createdAt 追加)
│   │   │   └── paths/
│   │   │       └── me.yaml               # ★ 新規 (GET /me 定義)
│   │   ├── package.json                  # ★ 更新 (cors, @workspace/auth)
│   │   └── src/
│   │       ├── infrastructure/
│   │       │   └── env.ts                # ★ 更新 (認証env変数追加)
│   │       ├── presentation/
│   │       │   ├── middleware/
│   │       │   │   ├── require-auth.middleware.ts       # ★ 新規
│   │       │   │   ├── require-auth.middleware.test.ts  # ★ 新規
│   │       │   │   └── index.ts                         # ★ 新規
│   │       │   └── controllers/
│   │       │       ├── user.controller.ts          # ★ 新規
│   │       │       ├── user.controller.test.ts     # ★ 新規
│   │       │       └── index.ts                    # ★ 更新
│   │       ├── application/
│   │       │   └── queries/
│   │       │       ├── get-current-user.use-case.ts # ★ 新規 (UserResponseDto もここで定義)
│   │       │       └── index.ts                     # ★ 更新
│   │       └── composition/
│   │           └── create-app.ts         # ★ 更新 (auth配線)
│   └── web/
│       ├── package.json                  # ★ 更新 (@workspace/auth)
│       └── lib/
│           └── auth-client.ts            # ★ 新規
├── .env.example                          # ★ 更新
├── turbo.json                            # ★ 更新
└── docs/
    └── architecture.md                   # ★ 更新 (packages/auth 追記)
```

---

## 依存グラフ（最終形）

```
apps/api  → @workspace/auth (server)  → better-auth, resend
          → @workspace/domain                (@prisma/client は peerDeps)
          → @workspace/database
apps/web  → @workspace/auth (client)  → better-auth
          → @workspace/ui
packages/database → @workspace/domain
```

**ポイント**: `@workspace/auth` は `@workspace/database` に依存しない。PrismaClient は `apps/api/src/composition/create-app.ts` から注入する。

---

## Step 1: packages/auth の器作り

**目標**: 型チェックが通る最小限の packages/auth を完成させ、pnpm install を通す。

### 作成ファイル

**packages/auth/package.json**
```json
{
  "name": "@workspace/auth",
  "version": "0.0.1",
  "private": true,
  "exports": {
    ".":        { "types": "./src/index.ts",  "default": "./src/index.ts" },
    "./server": { "types": "./src/server.ts", "default": "./src/server.ts" },
    "./client": { "types": "./src/client.ts", "default": "./src/client.ts" }
  },
  "scripts": { "typecheck": "tsc --noEmit", "lint": "eslint ." },
  "dependencies": {
    "better-auth": "^1.0.0",
    "resend": "^4.0.0"
  },
  "peerDependencies": {
    "@prisma/client": "^7",
    "react": "^19"
  },
  "peerDependenciesMeta": { "react": { "optional": true } },
  "devDependencies": {
    "@workspace/eslint-config": "workspace:*",
    "@workspace/typescript-config": "workspace:*",
    "typescript": "5.9.3"
  }
}
```

**packages/auth/tsconfig.json**
- `@workspace/typescript-config/base.json` を extends

**packages/auth/eslint.config.mjs**
- 他パッケージ（`packages/domain/eslint.config.mjs` 等）と同じパターンで `@workspace/eslint-config` を使用

**packages/auth/src/server.ts**
- `AuthConfig` インターフェース:
  ```typescript
  interface AuthConfig {
    prisma: PrismaClient
    secret: string
    baseURL: string
    resendApiKey: string
    google: { clientId: string; clientSecret: string }
    apple: { clientId: string; clientSecret: string }
  }
  ```
  > **Note**: Apple Sign In の `clientSecret` は better-auth が内部で JWT 形式に変換するため、
  > `APPLE_CLIENT_SECRET` 環境変数には Apple Developer から取得した秘密鍵（PEM 形式）を設定する。
  > `teamId` / `keyId` が別途必要かどうかは better-auth の Apple プロバイダー実装を確認すること。
- `createAuth(config: AuthConfig)` を export
  - `emailOtp` プラグイン: Resend でメール送信
  - `socialProviders`: google, apple
  - `user.additionalFields`: `role` (type: "string", defaultValue: "user", input: false), `displayName` (type: "string", required: false)
- `export type { AuthInstance, Session, User }` (better-auth の$Inferから推論)
- `export { toNodeHandler } from "better-auth/node"` (Express adapter の re-export)

**packages/auth/src/client.ts**
- `createClient(baseURL: string)` を export
- `createAuthClient` (better-auth/react) + plugins: `emailOtpClient()`, `inferAdditionalFields<AuthInstance>()`

**packages/auth/src/index.ts**
- `export type { AuthInstance, Session, User } from "./server"`

### 検証コマンド
```bash
pnpm install
pnpm --filter @workspace/auth typecheck
```

---

## Step 2: Database Schema & Domain Entity

**目標**: Prisma スキーマに better-auth テーブルを追加し、Domain の UserEntity・IUserRepository・IUserQueryService と DB実装を完成させる。

### 更新: packages/database/prisma/schema.prisma
以下の4モデルを追加（datasource/generator ブロックはそのまま）:

```prisma
model User {
  id            String    @id @default(cuid())
  name          String
  email         String    @unique
  emailVerified Boolean   @default(false)
  image         String?
  role          String    @default("user")
  displayName   String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  sessions      Session[]
  accounts      Account[]
}

model Session {
  id        String   @id @default(cuid())
  expiresAt DateTime
  token     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Account {
  id                    String    @id @default(cuid())
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}

model Verification {
  id         String    @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime? @default(now())
  updatedAt  DateTime? @updatedAt
}
```

### 新規: packages/domain/src/models/user.entity.ts

```typescript
import { BaseEntity } from "./base.entity"

export type UserRole = "user" | "admin"

export class UserEntity extends BaseEntity<string> {
  private constructor(
    id: string,
    readonly email: string,
    readonly name: string,
    readonly role: UserRole,
    readonly displayName: string | null,
  ) { super(id) }

  static reconstitute(
    id: string,
    email: string,
    name: string,
    role: UserRole,
    displayName: string | null,
  ): UserEntity {
    return new UserEntity(id, email, name, role, displayName)
  }
}
```

### 新規: packages/domain/src/repositories/user.repository.ts

CLAUDE.md の実装フロー「Domain: `*.entity.ts`, `*.repository.ts`」に従い、ユーザー固有のリポジトリインターフェースを定義する。

```typescript
import { IRepository } from "./base.repository"
import { UserEntity } from "../models/user.entity"

export interface IUserRepository extends IRepository<UserEntity, string> {
  // 現スコープでは findById / save / delete のみ。
  // User固有メソッド（findByEmail 等）が必要になったタイミングで追加する。
}
```

### 新規: packages/domain/src/services/ (新ディレクトリ)

**user.query-service.ts**

`UserQueryResult` は DB から読み取ったデータの Domain 側表現。DTO ではなくドメインの読み取り契約として定義する。
Response DTO への変換は Application 層（UseCase）で行う。

```typescript
import { UserRole } from "../models/user.entity"

export type UserQueryResult = {
  id: string
  email: string
  name: string
  role: UserRole
  displayName: string | null
  image: string | null
  emailVerified: boolean
  createdAt: Date
}

export interface IUserQueryService {
  findById(id: string): Promise<UserQueryResult | null>
}
```

### 新規: packages/database/src/repositories/user.prisma-repository.ts

```typescript
import { PrismaClient, Prisma, User as PrismaUser } from "@prisma/client"
import { IUserRepository, UserEntity, UserRole } from "@workspace/domain"
import { BasePrismaRepository } from "./base.prisma-repository"

export class UserPrismaRepository
  extends BasePrismaRepository<UserEntity, string, PrismaUser, Prisma.UserCreateInput>
  implements IUserRepository
{
  constructor(prisma: PrismaClient) { super(prisma) }

  protected toDomain(model: PrismaUser): UserEntity {
    return UserEntity.reconstitute(
      model.id,
      model.email,
      model.name,
      model.role as UserRole,
      model.displayName,
    )
  }

  protected toCreateInput(entity: UserEntity): Prisma.UserCreateInput {
    return {
      id: entity.id,
      email: entity.email,
      name: entity.name,
      role: entity.role,
      displayName: entity.displayName ?? null,
      emailVerified: false,
      // updatedAt は @updatedAt で Prisma が自動管理するため省略
    }
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({ where: { id } })
    return user ? this.toDomain(user) : null
  }

  async save(entity: UserEntity): Promise<void> {
    await this.prisma.user.upsert({
      where: { id: entity.id },
      // better-auth が管理する emailVerified / createdAt は update 時に含めない
      // updatedAt は @updatedAt で Prisma が自動更新するため省略
      update: {
        name: entity.name,
        role: entity.role,
        displayName: entity.displayName ?? null,
      },
      create: this.toCreateInput(entity),
    })
  }

  async delete(entity: UserEntity): Promise<void> {
    await this.prisma.user.delete({ where: { id: entity.id } })
  }
}
```

### 新規: packages/database/src/query-services/user.query-service.ts

```typescript
import { PrismaClient } from "@prisma/client"
import { IUserQueryService, UserQueryResult, UserRole } from "@workspace/domain"

export class UserQueryService implements IUserQueryService {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<UserQueryResult | null> {
    const raw = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        displayName: true,
        image: true,
        emailVerified: true,
        createdAt: true,
      },
    })
    if (!raw) return null
    // Prisma の生成型は role を string として扱うため UserRole へキャストする
    return { ...raw, role: raw.role as UserRole }
  }
}
```

### barrel index 更新
- `packages/domain/src/models/index.ts`: `UserEntity`, `UserRole` を追加
- `packages/domain/src/repositories/index.ts`: `IUserRepository` を追加
- `packages/domain/src/index.ts`: `export * from "./services"` を追加（コメントアウト行を有効化）
- `packages/database/src/repositories/index.ts`: `UserPrismaRepository` を追加
- `packages/database/src/query-services/index.ts`: `UserQueryService` を追加
- `packages/database/src/index.ts`: `export * from "./query-services"` を有効化

### 検証コマンド
```bash
pnpm --filter @workspace/database db:generate   # Prismaクライアント再生成
pnpm typecheck                                  # 全パッケージ型チェック
```
→ **DBマイグレーションは `prisma migrate dev` をユーザーが手動実行** (Docker Compose 起動が前提)

---

## Step 3: API Infrastructure — better-auth ルートのマウント

**目標**: `/api/auth/*` エンドポイントが動作することをブラウザ/curlで確認できる状態にする。

### 更新: apps/api/src/infrastructure/env.ts
追加する Zod フィールド:
```typescript
AUTH_SECRET: z.string().min(32),
API_BASE_URL: z.string().url().default("http://localhost:8080"),
WEB_BASE_URL: z.string().url().default("http://localhost:3001"),
RESEND_API_KEY: z.string().min(1),
GOOGLE_CLIENT_ID: z.string().min(1),
GOOGLE_CLIENT_SECRET: z.string().min(1),
APPLE_CLIENT_ID: z.string().min(1),
APPLE_CLIENT_SECRET: z.string().min(1),
```

### 更新: apps/api/src/composition/create-app.ts
auth インスタンスの初期化と `/api/auth` へのマウントのみ追加（/me は Step 4）:
```typescript
import { createAuth, toNodeHandler } from "@workspace/auth/server"
import { createPrismaClient } from "@workspace/database"
import cors from "cors"

export function createApp() {
  const prisma = createPrismaClient(env.DATABASE_URL, env.NODE_ENV === "development")
  const auth = createAuth({
    prisma,
    secret: env.AUTH_SECRET,
    baseURL: env.API_BASE_URL,
    resendApiKey: env.RESEND_API_KEY,
    google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
    apple: { clientId: env.APPLE_CLIENT_ID, clientSecret: env.APPLE_CLIENT_SECRET },
  })

  const app = express()
  // cors はすべてのルートに適用するため先行させる
  app.use(cors({ origin: env.WEB_BASE_URL, credentials: true }))
  // toNodeHandler はボディストリームを直接読むため express.json() より前に配置する
  app.use("/api/auth", toNodeHandler(auth))
  app.use(express.json())

  const apiRouter = express.Router()
  const healthController = new HealthController()
  apiRouter.get("/health", healthController.check)
  app.use("/api/v1", apiRouter)

  return app
}
```

### 更新: apps/api/package.json
- `cors`, `@types/cors`, `@workspace/auth: workspace:^` を追加

### Config 更新
- `.env.example` に認証関連変数を追加
- `turbo.json` の `globalEnv` に追加: `AUTH_SECRET`, `API_BASE_URL`, `WEB_BASE_URL`, `RESEND_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`, `NEXT_PUBLIC_API_URL`

### 検証コマンド・確認項目
```bash
pnpm install
pnpm typecheck
pnpm dev  # API サーバー起動
```
```bash
curl http://localhost:8080/api/auth/get-session
# → null (未ログイン時の正常レスポンス)
```

---

## Step 4: Protected Route & UseCase

**目標**: `/api/v1/me` が認証ミドルウェアで保護され、ログイン済みユーザーの情報を返す。

### 新規: apps/api/src/presentation/middleware/require-auth.middleware.ts

```typescript
import { Request, Response, NextFunction } from "express"
import { fromNodeHeaders } from "better-auth/node"
import { AuthInstance } from "@workspace/auth/server"

export type AuthenticatedRequest = Request & {
  auth: NonNullable<Awaited<ReturnType<AuthInstance["api"]["getSession"]>>>
}

export function createRequireAuth(auth: AuthInstance) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Express の IncomingHttpHeaders を Web API の Headers に変換してから渡す
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
      if (!session) {
        res.status(401).json({ error: "Unauthorized" })
        return
      }
      (req as AuthenticatedRequest).auth = session
      next()
    } catch {
      res.status(500).json({ error: "Internal Server Error" })
    }
  }
}
```

### 新規: apps/api/src/presentation/middleware/require-auth.middleware.test.ts
- 未認証時に 401 を返すことをテスト
- 認証済み時に `req.auth` がセットされ `next()` が呼ばれることをテスト
- `getSession` が例外をスローした場合に 500 を返すことをテスト

### 新規: apps/api/src/application/queries/get-current-user.use-case.ts

CLAUDE.md 規約「Response DTO: Application で組み立てる」に従い、`UserResponseDto` はここで定義・返却する。
UseCase は `IUserQueryService`（Domain）から `UserQueryResult` を受け取り、`UserResponseDto` として組み立てる。

```typescript
import { BaseQueryUseCase } from "./base.query"
import { IUserQueryService, UserRole } from "@workspace/domain"

export type UserResponseDto = {
  id: string
  email: string
  name: string
  role: UserRole
  displayName: string | null
  image: string | null
  emailVerified: boolean
  createdAt: Date
}

export class GetCurrentUserUseCase
  extends BaseQueryUseCase<{ userId: string }, UserResponseDto | null>
{
  constructor(private readonly userQueryService: IUserQueryService) { super() }

  async execute({ userId }: { userId: string }): Promise<UserResponseDto | null> {
    const result = await this.userQueryService.findById(userId)
    if (!result) return null
    return {
      id: result.id,
      email: result.email,
      name: result.name,
      role: result.role,
      displayName: result.displayName,
      image: result.image,
      emailVerified: result.emailVerified,
      createdAt: result.createdAt,
    }
  }
}
```

### 新規: apps/api/src/presentation/controllers/user.controller.ts

```typescript
import { Response } from "express"
import { GetCurrentUserUseCase } from "../../application"
import { AuthenticatedRequest } from "../middleware/require-auth.middleware"

export class UserController {
  constructor(private readonly getCurrentUserUseCase: GetCurrentUserUseCase) {}

  getUserMe = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await this.getCurrentUserUseCase.execute({ userId: req.auth.user.id })
      if (!user) {
        res.status(404).json({ error: "User not found" })
        return
      }
      res.json(user)
    } catch {
      res.status(500).json({ error: "Internal Server Error" })
    }
  }
}
```

### 新規: apps/api/src/presentation/controllers/user.controller.test.ts
- 認証済みユーザーが存在する場合に 200 + ユーザー情報を返すことをテスト
- ユーザーが見つからない場合に 404 を返すことをテスト
- UseCase が例外をスローした場合に 500 を返すことをテスト

### 更新: apps/api/src/composition/create-app.ts (Step 3 からの差分)
```typescript
import { createRequireAuth, UserController } from "../presentation"
import { UserQueryService } from "@workspace/database"
import { GetCurrentUserUseCase } from "../application"

// Step 3 の createApp() に追加
const requireAuth = createRequireAuth(auth)
const userQueryService = new UserQueryService(prisma)
const getCurrentUserUseCase = new GetCurrentUserUseCase(userQueryService)
const userController = new UserController(getCurrentUserUseCase)

apiRouter.get("/me", requireAuth, userController.getUserMe)
```

### barrel index 更新
- `application/queries/index.ts`: `GetCurrentUserUseCase`, `UserResponseDto` を追加
- `presentation/middleware/index.ts`: `createRequireAuth`, `AuthenticatedRequest` を export する `index.ts` を新規作成
- `presentation/index.ts`: `export * from "./middleware"` を追加
- `presentation/controllers/index.ts`: `UserController` を追加

### 新規: apps/web/lib/auth-client.ts
```typescript
import { createClient } from "@workspace/auth/client"
export const authClient = createClient(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"
)
```

### 更新: apps/web/package.json
- `@workspace/auth: workspace:*` を追加

### OpenAPI 定義の更新

**更新: apps/api/docs/components/schemas/User.yaml**
better-auth の additionalFields + `createdAt` を追加:
```yaml
role:
  type: string
  enum: [user, admin]
  description: User role
displayName:
  type: string
  nullable: true
  description: User display name (user-settable)
emailVerified:
  type: boolean
image:
  type: string
  nullable: true
createdAt:
  type: string
  format: date-time
```

**新規: apps/api/docs/paths/me.yaml**
```yaml
get:
  summary: Get current user
  description: Returns the authenticated user's profile
  tags:
    - Users
  security:
    - cookieAuth: []
  responses:
    '200':
      description: Current user profile
      content:
        application/json:
          schema:
            $ref: '../components/schemas/User.yaml'
    '401':
      description: Unauthorized
      content:
        application/json:
          schema:
            $ref: '../components/schemas/Error.yaml'
    '404':
      description: User not found
      content:
        application/json:
          schema:
            $ref: '../components/schemas/Error.yaml'
```

**更新: apps/api/docs/openapi.yaml**
- `/me` path を追加: `$ref: './paths/me.yaml'`
- `components.securitySchemes` に cookieAuth を追加:
  ```yaml
  securitySchemes:
    cookieAuth:
      type: apiKey
      in: cookie
      name: better-auth.session_token
  ```

### Docs 更新
- `docs/architecture.md`: packages/auth をディレクトリ構造・依存グラフ・インフラ共有パターンに追記
- `CLAUDE.md`: packages/auth の存在・役割・依存方向を認証セクションとして追記

### 検証コマンド・確認項目
```bash
pnpm typecheck

# 未認証の場合
curl http://localhost:8080/api/v1/me
# → 401 Unauthorized

# 認証済みの場合 (Cookie付き)
curl -b "session=..." http://localhost:8080/api/v1/me
# → { id, email, name, role, displayName, image, emailVerified, createdAt }
```
