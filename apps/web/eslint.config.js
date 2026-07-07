import { nextJsConfig } from "@workspace/eslint-config/next-js"

/** @type {import("eslint").Linter.Config} */
export default [
  ...nextJsConfig,
  {
    // wrangler types で自動生成される型定義ファイル、および OpenNext / wrangler の
    // ビルド成果物ディレクトリ。いずれも生成物のため Lint 対象外とする。
    // cloudflare-env.d.ts は生成物自体にも `/* eslint-disable */` が挿入されるが、
    // 生成テンプレートの変更（disable コメントが外れる等）に備えて ignore 側でも明示的に除外する。
    ignores: ["cloudflare-env.d.ts", ".open-next/**", ".wrangler/**"],
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
