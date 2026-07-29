import { config } from "@workspace/eslint-config/base"

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  {
    // wrangler のビルド成果物 (deploy --dry-run の出力先 dist/ と一時バンドル .wrangler/)。
    // いずれも生成物のため Lint 対象外とする (apps/web の eslint.config.js と同じ方針)。
    ignores: ["dist/**", ".wrangler/**"],
  },
  {
    files: ["src/presentation/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@workspace/*/src/**", "@workspace/*/dist/**"],
              message:
                "Use the package public entry (e.g. '@workspace/foo') instead of deep imports.",
            },
            {
              group: ["../../*/**"],
              message:
                "Cross-layer imports must go through the layer's index.ts (barrel).",
            },
            {
              group: ["@workspace/domain", "@workspace/domain/**"],
              message:
                "Presentation must depend on Application errors, not Domain errors.",
            },
          ],
        },
      ],
    },
  },
]
