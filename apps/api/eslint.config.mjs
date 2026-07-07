import { config } from "@workspace/eslint-config/base";

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  {
    // wrangler のビルド成果物 (deploy --dry-run の出力先 dist/ と一時バンドル .wrangler/)。
    // いずれも生成物のため Lint 対象外とする (apps/web の eslint.config.js と同じ方針)。
    ignores: ["dist/**", ".wrangler/**"],
  },
];
