# 1. Pruner
FROM node:20-alpine AS pruner
RUN npm install -g turbo
WORKDIR /app
COPY . .
RUN turbo prune web --docker

# 2. Installer
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
RUN npm install -g pnpm turbo && turbo build --filter=web

# 4. Runner (Next.js Standalone用)
FROM node:20-alpine AS runner
WORKDIR /app
# 実行に必要なファイルだけをコピー
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

ENV NODE_ENV production
ENV PORT 3000
EXPOSE 3000

# Standaloneモードの出力先にあるserver.jsを実行
CMD ["node", "apps/web/server.js"]