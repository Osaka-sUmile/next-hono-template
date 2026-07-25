import { nextJsConfig } from "@workspace/eslint-config/next-js"

/** @type {import("eslint").Linter.Config} */
export default [
  ...nextJsConfig,
  {
    // wrangler types / openapi-typescript で自動生成される型定義ファイル、および
    // OpenNext / wrangler のビルド成果物ディレクトリ。いずれも生成物のため Lint 対象外とする。
    // cloudflare-env.d.ts は生成物自体にも `/* eslint-disable */` が挿入されるが、
    // 生成テンプレートの変更（disable コメントが外れる等）に備えて ignore 側でも明示的に除外する。
    // api-schema.d.ts は apps/api/openapi.json から openapi-typescript が生成する
    // (pnpm run openapi:generate)。手で直さないため同様に対象外とする。
    ignores: ["cloudflare-env.d.ts", "lib/api-schema.d.ts", ".open-next/**", ".wrangler/**"],
  },
  {
    // next.config.mjs は Node.js ランタイムで実行される設定ファイルのため process を許可する。
    files: ["next.config.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
      },
    },
  },
]
