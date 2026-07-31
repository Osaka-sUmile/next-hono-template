# Codex 自動 PR レビュー

CodeRabbit とは別のレビューエンジンとして、OpenAI Codex CLI を GitHub Actions 上で実行し、PR の差分をレビューします。実装を担当した AI / 人間とは**別モデル**にレビューさせることで、自己レビューによる見落としを減らす目的です。

## 概要

| 項目 | 内容 |
|------|------|
| Workflow | `.github/workflows/codex-review.yml` |
| プロンプト | `.github/prompts/codex-review.md` |
| トリガー | PR の `opened` / `synchronize` / `reopened`、および `workflow_dispatch` |
| 対象ブランチ | `main`、`develop` 向け PR |
| 投稿形式 | トップレベルの PR レビュー（`COMMENT`）。インラインコメントは使わない |

## CodeRabbit との役割の違い

| | CodeRabbit | Codex |
|---|------------|-------|
| 実行基盤 | CodeRabbit サービス | Codex CLI + OpenAI API |
| レビュー観点 | リポジトリ規約（`.coderabbit.yaml`） | DDD/CQRS・Cloudflare Workers 等を含むプロンプト |
| コメント形式 | ウォークスルー + インライン | 1 件の PR レビュー本文に集約 |
| マージブロック | `request_changes_workflow` あり | **なし**（参考情報のみ） |
| コメント resolve | 手動 / スキルで対応 | **自動 resolve しない** |

両方を併用し、拾う問題の角度を補完します。

## セットアップ

### 1. Repository Secret

GitHub リポジトリの **Settings → Secrets and variables → Actions** に次を登録します。

| Secret | 説明 |
|--------|------|
| `OPENAI_API_KEY` | OpenAI API キー。Codex CLI が OpenAI API 経由でモデルを呼び出す際に使用 |

**必須:** 未設定のまま Workflow を実行すると `401 Unauthorized` で失敗します。Organization secret を使う場合は、対象リポジトリへのアクセス権も確認してください。

Codex CLI は `--ignore-user-config` 使用時に環境変数 `OPENAI_API_KEY` を自動では読み込まない。Workflow 内で `codex login --with-api-key` により認証情報を設定する。

Azure OpenAI は使用しません。

### 2. 権限

Workflow は `contents: read` と `pull-requests: write` で動作します。fork からの PR には Secrets が渡らないため、外部 fork PR は自動スキップされます。

## 実行対象とスキップ条件

### 実行される PR

- `main` / `develop` 向けの通常 PR
- **draft PR**（`opened` で draft 作成時も対象）
- **ドキュメントのみ**の PR

`ready_for_review` はトリガーに含めていません（draft → ready で同一 SHA の重複実行を避けるため）。draft 昇格後に再レビューしたい場合は手動再実行を使います。

### スキップされる PR

- Dependabot が作成した PR（PR 作者が `dependabot[bot]`）
- 外部 fork からの PR（head リポジトリが本リポジトリと一致しない場合。**`workflow_dispatch` でも同様**）
- **同一 head SHA に対して既に Codex レビューが投稿済み**の場合（手動再実行時の重複防止）

## Verdict の意味

Codex の出力末尾には必ず次のいずれかが含まれます。

```text
CODEX VERDICT: LGTM
CODEX VERDICT: CHANGES REQUESTED
```

| Verdict | 意味 | Workflow の結果 |
|---------|------|-----------------|
| `LGTM` | Critical / High / Medium の未解決指摘なし | **成功** |
| `CHANGES REQUESTED` | 修正が望ましい指摘あり | **成功**（失敗扱いにしない） |

Codex CLI の実行失敗、API エラー、タイムアウト、出力形式不正（verdict 欠落・空出力）は Workflow **失敗**になります。

Verdict はマージ条件には使いません。`APPROVE` / `REQUEST_CHANGES` の GitHub レビューイベントは発行しません。

## 手動再実行

1. GitHub の **Actions** タブを開く
2. **Codex review** を選択
3. **Run workflow** をクリック
4. レビュー対象の **PR 番号** を入力して実行

同一 commit SHA に対するレビューが既にある場合は、重複投稿を避けてスキップします。新しいコミットを push した後は通常の `synchronize` トリガーで新しいレビューが投稿されます。

## 連続 push 時の挙動

`concurrency.cancel-in-progress: true` により、同一 PR への連続 push では古い実行がキャンセルされ、最新コミットに対する 1 回のレビューに集約されます。

## バージョン管理

Workflow 内の `env` で固定しています。

| 変数 | 現在の値 | 更新方法 |
|------|----------|----------|
| `CODEX_VERSION` | `0.146.0` | `.github/workflows/codex-review.yml` の `env.CODEX_VERSION` を更新。pnpm store の cache キーも同バージョン |
| `CODEX_MODEL` | `gpt-5.3-codex` | 同上の `env.CODEX_MODEL` を更新 |

Codex CLI の更新手順:

1. `pnpm view @openai/codex version` で利用可能なバージョンを確認
2. Workflow の `CODEX_VERSION` を更新してコミット
3. テスト PR で動作確認

## コスト

OpenAI API の利用料金が発生します。`concurrency` による実行集約と、同一 SHA の重複スキップで不要な呼び出しを抑えていますが、PR ごとに API コールは発生します。

## 運用上の注意

- Codex が投稿したレビューコメント・スレッドは **自動では resolve しません**
- Codex は **コードを自動修正しません**（レビューのみ）
- インラインコメントは投稿しません

レビュー指摘への対応フローは、CodeRabbit 用の `.claude/skills/coderabbit-pr-fix/SKILL.md` とは別です。Codex の指摘は PR レビュー本文を読んで手動で対応してください。

## 関連 Issue

- #168 — 本機能の導入
- #170 — レビューと修正の自動ループ（本ドキュメントの対象外）
