# ESLint 運用方針

機械的に判定できるコード品質・型安全性・複雑度を CI で検出し、人間や AI のレビュー負荷を下げる。設定の中心は `packages/eslint-config` です。

## 構成

| 実行 | コマンド | 内容 |
|------|----------|------|
| 通常 lint | `pnpm lint` | SonarJS・Security・複雑度（warn）・Barrel 制約など。型情報不要。 |
| 型情報付き lint | `pnpm lint:type-aware` | Promise 誤用・`await` 漏れ・`no-base-to-string` など。`projectService` 使用。 |

**案 B（分離）を採用:** 型情報付き lint は別タスクとして Turbo / CI で実行する。エディタの通常 lint 体験を軽く保ちつつ、CI で型関連のバグをブロックする。

ローカル計測（2026-07-31、キャッシュ無効時の目安）:

| コマンド | 所要時間（概算） |
|----------|------------------|
| `pnpm lint` | 約 10 秒 |
| `pnpm lint:type-aware` | 約 22 秒 |

## ルールの目的

### 型安全性（型情報付き・`error`）

| ルール | 目的 |
|--------|------|
| `@typescript-eslint/no-floating-promises` | 未 `await` の Promise（サイレント失敗） |
| `@typescript-eslint/no-misused-promises` | async を同期 API に渡す誤り |
| `@typescript-eslint/await-thenable` | 非 Promise への `await` |
| `@typescript-eslint/no-base-to-string` | オブジェクトの暗黙文字列化（`[object Object]` 等） |

### 型安全性（通常 lint）

| ルール | レベル | 目的 |
|--------|--------|------|
| `@typescript-eslint/no-explicit-any` | warn | `any` の安易な使用を可視化 |
| `@typescript-eslint/no-non-null-assertion` | warn | `!` による仮定の可視化 |
| `@typescript-eslint/consistent-type-assertions` | warn | 型アサーションのスタイル統一 |
| `sonarjs/no-ignored-exceptions` | warn | 空の catch ブロック |

### 複雑度（`warn` — 初回導入）

**`#171` で確定した基準（`CLAUDE.md` と一致）:**

| ルール | 閾値 |
|--------|------|
| `max-lines-per-function` | 20 行（空行・コメント除外） |
| `complexity` | 20 |
| `max-depth` | 4 |
| `max-params` | 6 |
| `max-nested-callbacks` | 4 |
| `sonarjs/cognitive-complexity` | 15 |

複雑度違反は**自動的に設計ミスを意味しない**。フレームワークのコールバック構造やトランザクション境界で警告が出ることはある。lint を通すためだけの不自然な分割は行わない。

### SonarJS・Security

- `eslint-plugin-sonarjs` recommended をベースに採用。
- Sonar recommended のうち UI / テスト / ライブラリ境界でノイズが高いルール（`no-nested-conditional`、`prefer-read-only-props`、`deprecation` 等）は初回導入時 **warn** とし、バックログ解消後に error へ段階昇格する（一覧は `packages/eslint-config/base.js` のコメント参照）。
- `sonarjs/assertions-in-tests` は Vitest の `expect` を認識するためテストでも有効（誤検知が多い場合は override で調整）。
- `eslint-plugin-security` recommended を採用し、パストラバーサル等のノイズが高い 3 ルールは off（理由は `base.js` にコメント）。

## `warn` から `error` への引き上げ

1. 既存違反を `pnpm lint` の出力で把握する。
2. 明確なバグ・危険（分類 A）と小さな修正（分類 B）は PR で解消する。
3. 大規模リファクタが必要なもの（分類 C）は別 Issue へ。
4. フレームワーク・設定固有（分類 D）は `packages/eslint-config` の `files` override に理由付きで記載。
5. 誤検知（分類 E）はルール off または適用範囲縮小し、PR / 本ドキュメントに理由を残す。
6. バックログが空になったルールから `error` へ段階的に昇格する。

複雑度ルールは初回から `error` にしない。`--max-warnings 0` は複雑度を `error` にするまで使わない。

## 例外の追加方法

- **インライン `eslint-disable` は使用しない。**
- **`@ts-ignore` は使用しない。**
- **`@ts-expect-error` は使用しない。** 型エラーは Vitest の型テスト API（`expectTypeOf` 等）またはコンパイル失敗 fixture で検証する。
- 例外は `packages/eslint-config/base.js`（または `type-aware.js`）の `files` override に集約し、**理由をコメント**する。
- 警告を消すためだけの `any`・型アサーション・non-null assertion への置換は禁止。

## 参考実装との差分

| 項目 | 参考（MulmoTerminal / MulmoClaude） | 本リポジトリ |
|------|-------------------------------------|--------------|
| プリセット | `strict` 一括 | `recommended` + 個別ルール追加（段階導入） |
| 複雑度 | 多くが `error` | 初回はすべて `warn` |
| 型情報 lint | 広い `strictTypeChecked` | 実害が大きい 4 ルールに限定（テスト含む。誤検知ルールのみ override） |
| 実行 | 単一パス | `lint` と `lint:type-aware` を分離 |
| Security | グローバル + tuning | 同様の 3 ルール off |
| Vue / i18n | あり | 対象外（Next.js + React） |

## 各 workspace の適用

各パッケージは `eslint.config.*` で共有設定を import し、`eslint.type-aware.config.*` で型情報付き設定を追加する。ルールの重複定義はしない。

`lint:type-aware` の CLI 引数は全 workspace で `eslint -c eslint.type-aware.config.* .` に統一する（`.` 明示で検査対象を揃える）。

型情報付き lint の除外対象（`packages/eslint-config/type-aware.js` の `ignores`）:

- ルート TS 設定: `vitest.config.*`, `prisma.config.*`, `playwright.config.*`, `next.config.*`
- ESLint 設定自身: `eslint.config.*`, `eslint.type-aware.config.*`

`scripts/**` はビルド用 `tsconfig.json`（`include: ["src"]`）の対象外だが、各 workspace の `tsconfig.eslint.json` と Flat Config override（`parserOptions.project`）で型情報 lint の対象とする。

`test-utils/**` は型情報 lint の対象とする（async のテストインフラで Promise 誤用を検出するため）。

`lint:type-aware` は `projectService` による静的解析のため Turbo 上で `^build` に依存しない（`turbo.json`）。

## 関連

- 開発ガイドライン: ルート `CLAUDE.md`
- 設定実装: `packages/eslint-config/`
- Issue: #169
