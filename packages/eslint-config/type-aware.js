/**
 * Type-aware ESLint rules that require TypeScript program information.
 * Use via `lint:type-aware` (separate from fast `lint`) — see docs/eslint-policy.md.
 *
 * @param {string} tsconfigRootDir Workspace package root (directory containing tsconfig.json).
 * @returns {import("eslint").Linter.Config[]}
 */
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
        // scripts/*.mts は tsconfig include が src のみのため projectService 対象外。含めるには tsconfig.eslint.json 等が必要。
        "**/scripts/**",
      ],
    },
    {
      files: ["**/*.{ts,tsx,mts,cts}"],
      ignores: [
        "**/eslint.config.*",
        "**/eslint.type-aware.config.*",
      ],
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      rules: {
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
      },
    },
  ]
}
