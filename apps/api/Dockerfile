# 1. Pruner (依存関係の抽出)
FROM node:20-alpine AS pruner
RUN npm install -g turbo
WORKDIR /app
COPY . .
RUN turbo prune api --docker

# 2. Installer (依存関係のインストール)
FROM node:20-alpine AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN npm install -g pnpm && pnpm install

# 3. Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=pruner /app/out/full/ .
COPY --from=installer /app/ .
RUN npm install -g pnpm turbo && turbo build --filter=api

# 4. Runner
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app .
WORKDIR /app/apps/api
CMD ["node", "dist/index.js"]