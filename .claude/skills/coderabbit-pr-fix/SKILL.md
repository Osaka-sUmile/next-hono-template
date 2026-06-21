---
description: CodeRabbitレビューを精査し、妥当な指摘のみ修正してcommit/pushし、定型コメントを投稿する
---

# CodeRabbit PRレビュー対応フロー

あなたはサブエージェントを積極的に活用して、以下を**順番に**実行してください。

## 目的

GitHubのPRレビュー（CodeRabbit）を確認し、各レビュー指摘の妥当性を検証する。  
妥当だと判断した指摘のみ修正し、妥当でないものはPRにコメントで理由を残す。  
その後、commit & pushし、最後に指定の呼びかけコメントを投稿する。

## 実行手順

1. 現在のブランチ名を確認する。
2. そのブランチに紐づくPRを特定し，最新のコメントを確認する。もし，最新のコメントがCoderabbitのレビューでなければ、Coderabbitのレビューが来るまで待機する（例: バックグラウンドで400秒程度．経過後，変わってなかったら，再び120秒バックグラウンドで待機．それでもレビューが来なかったら終了する）。Coderabbitの「 Actions performed」などのコメントが最新である場合も、レビューが来るまで待機する。
3. **GraphQL API** を使って、対象PRの全レビュースレッドを取得し、**`isResolved: false` のスレッドのみ**を対象にする。

   ```bash
   gh api graphql -f query='
   {
     repository(owner: "OWNER", name: "REPO") {
       pullRequest(number: PR_NUMBER) {
         reviewThreads(first: 100) {
           nodes {
             isResolved
             isOutdated
             comments(first: 1) {
               nodes {
                 databaseId
                 path
                 line
                 body
               }
             }
           }
         }
       }
     }
   }' --jq '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)] | .[] | {id: .comments.nodes[0].databaseId, path: .comments.nodes[0].path, line: .comments.nodes[0].line, body: .comments.nodes[0].body}'
   ```

4. 各レビュー指摘について、以下を実施する。
   - コードと文脈を読み、妥当性を検証する。
   - **妥当な指摘のみ**修正する。
   - **妥当でない指摘**は、なぜ不採用かを**その指摘コメント自体に直接 reply** する（PR全体コメントは使わない）。
     - **別PRで対応すべき場合**は、replyで「別PRで対応する」旨を伝えたうえで、CodeRabbitにissue作成とスレッドresolveを依頼する。
       ```
       @coderabbitai このコメントは別PRで対応します。issueを作成し、このスレッドをresolveしてください。
       ```
     - **それ以外の不採用理由**（仕様不一致・誤検知など）は、replyのみで対応する。
     ```bash
     gh api repos/OWNER/REPO/pulls/PR_NUMBER/comments \
       -X POST \
       -F in_reply_to=COMMENT_ID \
       -F body="不採用理由..."
     ```
5. 修正内容をテストまたは最小限の検証で確認する。
6. 変更をcommitしてpushする（必要なファイルのみ含める）。
7. PRに以下のコメントを投稿する（文面は完全一致）。
   - `@coderabbit review 修正対応できているレビューはResolveしてください。`
8. 以下で 420秒間バックグラウンド待機する（`run_in_background: true` で Bash 実行）。
   ```bash
   sleep 420
   ```
11. GraphQL APIで `isResolved: false` のスレッドを再取得し、CodeRabbit がApprovedなら処理を完了。そうでなければ，新しいレビューが返ってきていれば 3. から繰り返す。新しいレビューがない場合は，再度 420秒待機してから11. を繰り返す。(ループしすぎたら(5回くらい)適宜終了する)

## 厳守ルール

- **`isResolved: false` のスレッドのみを対象にする**。resolve済みは無視する。
- 推測で修正せず、該当コードを必ず確認してから判断する。
- 妥当性判断は「再現性」「仕様整合性」「既存実装との整合性」を根拠に行う。
- 無関係なリファクタや過剰な変更は行わない。
- 既存のユーザー変更を勝手に巻き戻さない。

## 最終報告フォーマット

最後に以下を簡潔に報告する。

- 対象PR（URL）
- 確認したレビュー件数（isResolved: false のみ）
- 修正した件数
- 却下してコメントした件数
- 実行した検証内容
- commit hash
- push結果
