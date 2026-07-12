// deploy スクリプトの誤実行ガード。
// デプロイは CI (GitHub Actions) 経由を前提とし、ローカルからの `pnpm run deploy` を
// デフォルトで拒否する。CI では CI=true が自動設定されるため、この判定で区別できる。
// シェルに CLOUDFLARE_ENV=production 等が残ったまま実行すると、checks / migrate を
// 経ずに本番へ直接デプロイされてしまう事故を防ぐのが目的。
//
// 初回セットアップ (workers.dev サブドメイン登録や URL 確認のための手動デプロイ) など、
// 意図的にローカルから実行する場合は ALLOW_LOCAL_DEPLOY=1 を付けること:
//   ALLOW_LOCAL_DEPLOY=1 CLOUDFLARE_ENV=preview pnpm run deploy
if (!process.env.CI && process.env.ALLOW_LOCAL_DEPLOY !== "1") {
  console.error(
    [
      "ローカルからの deploy をブロックしました。",
      "デプロイは CI (GitHub Actions の deploy.yml) 経由で行ってください。",
      "意図的にローカルから実行する場合は ALLOW_LOCAL_DEPLOY=1 を付けてください:",
      "  ALLOW_LOCAL_DEPLOY=1 CLOUDFLARE_ENV=<preview|production> pnpm run deploy",
    ].join("\n"),
  );
  process.exit(1);
}
