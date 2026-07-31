import js from "@eslint/js"
import eslintConfigPrettier from "eslint-config-prettier"
import pluginSecurity from "eslint-plugin-security"
import pluginSonarjs from "eslint-plugin-sonarjs"
import turboPlugin from "eslint-plugin-turbo"
import tseslint from "typescript-eslint"

/**
 * Complexity guards (#171: MUST keep functions under 20 lines). Warn-only on introduction.
 */
const complexityRules = {
  "max-lines-per-function": [
    "warn",
    { max: 20, skipBlankLines: true, skipComments: true },
  ],
  complexity: ["warn", 20],
  "max-depth": ["warn", 4],
  "max-params": ["warn", 6],
  "max-nested-callbacks": ["warn", 4],
  "sonarjs/cognitive-complexity": ["warn", 15],
}

/**
 * A shared ESLint configuration for the repository.
 *
 * eslint-plugin-only-warn は採用しない。CI でブロックすべきルール
 * (no-restricted-imports による Barrel 違反など) を warning に
 * 格下げしてしまい、ガードが看板倒れになるため。
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  pluginSonarjs.configs.recommended,
  pluginSecurity.configs.recommended,
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-assertions": [
        "warn",
        { assertionStyle: "as", objectLiteralTypeAssertions: "never" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "sonarjs/no-ignored-exceptions": "warn",
      // Sonar recommended のうち UI / Next.js / テストでノイズが高いものは warn で導入（段階的 error 化）。
      "sonarjs/no-nested-conditional": "warn",
      "sonarjs/no-globals-shadowing": "warn",
      "sonarjs/no-hardcoded-passwords": "warn",
      "sonarjs/no-identical-functions": "warn",
      "sonarjs/super-linear-regex": "warn",
      "sonarjs/no-floating-point-equality": "warn",
      "sonarjs/pseudo-random": "warn",
      "sonarjs/prefer-read-only-props": "warn",
      "sonarjs/different-types-comparison": "warn",
      "sonarjs/deprecation": "warn",
      ...complexityRules,
      // Barrel Pattern: 外部パッケージは package.json の公開エントリ経由のみ許可。
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
      // High-noise, low-signal on this repo (validated paths, Prisma, regex in routes).
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-object-injection": "off",
      "security/detect-non-literal-regexp": "off",
    },
  },
  {
    // Vitest suites are nested callbacks by design; keep cognitive complexity on.
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    rules: {
      "no-restricted-imports": "off",
      "max-lines-per-function": "off",
      "max-nested-callbacks": "off",
    },
  },
  {
    files: [
      "**/eslint.config.*",
      "**/eslint.type-aware.config.*",
      "**/vitest.config.*",
      "**/next.config.*",
      "**/prisma.config.*",
      "**/playwright.config.*",
    ],
    rules: {
      "max-lines-per-function": "off",
      complexity: "off",
      "sonarjs/cognitive-complexity": "off",
    },
  },
  {
    // Bounded email pattern (`[^\s@]` only). Sonar flags super-linear-regex; ReDoS risk is negligible here.
    files: ["**/user.entity.ts"],
    rules: {
      "sonarjs/super-linear-regex": "off",
    },
  },
  {
    ignores: [
      "dist/**",
      ".next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/prisma/migrations/**",
    ],
  },
]
