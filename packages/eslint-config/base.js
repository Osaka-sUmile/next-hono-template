import js from "@eslint/js"
import eslintConfigPrettier from "eslint-config-prettier"
import turboPlugin from "eslint-plugin-turbo"
import tseslint from "typescript-eslint"

/**
 * A shared ESLint configuration for the repository.
 *
 * eslint-plugin-only-warn は採用しない。CI でブロックすべきルール
 * (no-restricted-imports による Barrel 違反など) を warning に
 * 格下げしてしまい、ガードが看板倒れになるため。
 *
 * @type {import("eslint").Linter.Config}
 * */
export const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // Barrel Pattern: 外部パッケージは package.json の公開エントリ経由のみ許可。
      // 深い相対パス (例: @workspace/database/src/...) を import するのを禁止する。
      // 同一パッケージ内の越境 (例: presentation -> application/commands/foo.use-case)
      // についても、index.ts を経由するため `../../*/**` の深い相対参照を禁ずる。
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
          ],
        },
      ],
    },
  },
  {
    // テストファイルは test-utils などのヘルパを直接参照することがあるため barrel ルール除外
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    ignores: ["dist/**", ".next/**", "**/.turbo/**", "**/coverage/**"],
  },
]
