/**
 * Type-aware ESLint rules that require TypeScript program information.
 * Use via `lint:type-aware` (separate from fast `lint`) — see docs/eslint-policy.md.
 *
 * @param {string} tsconfigRootDir Workspace package root (directory containing tsconfig.json).
 * @returns {import("eslint").Linter.Config[]}
 */
const typeAwareRules = {
  "@typescript-eslint/no-base-to-string": "error",
  "@typescript-eslint/no-floating-promises": "error",
  "@typescript-eslint/no-misused-promises": [
    "error",
    {
      checksVoidReturn: {
        attributes: false,
      },
    },
  ],
  "@typescript-eslint/await-thenable": "error",
}

export function createTypeAwareConfig(tsconfigRootDir) {
  return [
    {
      ignores: [
        "**/vitest.config.*",
        "**/vitest.*.config.*",
        "**/prisma.config.*",
        "**/prisma.*.config.*",
        "**/playwright.config.*",
        "**/next.config.*",
      ],
    },
    {
      files: ["**/*.{ts,tsx,mts,cts}"],
      ignores: [
        "**/eslint.config.*",
        "**/eslint.type-aware.config.*",
        "scripts/**",
      ],
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      rules: typeAwareRules,
    },
    {
      // scripts/*.mts はビルド用 tsconfig の include 外。ESLint 専用 tsconfig.eslint.json で型解決する。
      files: ["scripts/**/*.{ts,mts,cts}"],
      languageOptions: {
        parserOptions: {
          project: ["./tsconfig.eslint.json"],
          tsconfigRootDir,
        },
      },
      rules: typeAwareRules,
    },
  ]
}
