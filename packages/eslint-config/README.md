# `@workspace/eslint-config`

モノレポ共有の ESLint Flat Config。

## エクスポート

| パス | 用途 |
|------|------|
| `@workspace/eslint-config/base` | 全 workspace 共通（SonarJS・Security・複雑度・Barrel 制約） |
| `@workspace/eslint-config/next-js` | Next.js アプリ（`apps/web`） |
| `@workspace/eslint-config/react-internal` | React ライブラリ（`packages/ui`） |
| `@workspace/eslint-config/type-aware` | 型情報付きルール（`createTypeAwareConfig(tsconfigRootDir)`） |

運用方針は `docs/eslint-policy.md` を参照。
