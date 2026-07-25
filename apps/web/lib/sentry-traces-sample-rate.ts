/**
 * 環境ごとの tracesSampleRate の既定値。
 *
 * トランザクション（ページ遷移や API 呼び出しの所要時間の記録）はエラーと違い正常時も
 * 毎回発生するため、全件送るとクォータを消費する。本番はサンプリングし、トラフィックの
 * 少ない preview は少し高め、ローカル開発は全件にする。
 *
 * api 側（apps/api/src/infrastructure/sentry-options.ts）と同じ値を意図的に重複させている。
 * web は @sentry/nextjs、api は @sentry/cloudflare を使い共有パッケージを持てないため。
 * 値を変えるときは両方と docs/deployment.md を合わせること。
 */
const DEFAULT_TRACES_SAMPLE_RATE: Record<string, number> = {
  production: 0.1,
  preview: 0.2,
};

/** 既知の環境名に当てはまらない場合（development / 未設定など）の既定値。 */
const FALLBACK_TRACES_SAMPLE_RATE = 1;

/**
 * Sentry の tracesSampleRate を決める。
 *
 * `NEXT_PUBLIC_*` はビルド時にインライン化されるため、値の読み出しは呼び出し側
 * （instrumentation-client.ts / instrumentation.ts）で `process.env` を直接参照し、
 * この関数は解釈だけを担う純関数にしてテスト可能にしている。
 *
 * @param environment `NEXT_PUBLIC_SENTRY_ENVIRONMENT` または `NODE_ENV`
 * @param override `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`（運用で率を変えたいときのみ設定）
 */
export function resolveTracesSampleRate(
  environment: string | undefined,
  override: string | undefined,
): number {
  const trimmed = override?.trim();
  if (trimmed !== undefined && trimmed !== "") {
    const parsed = Number(trimmed);
    // 0 と 1 は有効な指定なので、falsy 判定ではなく範囲で判定する。
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) return parsed;
    // 設定ミスでトレースを失うより既定値で動くほうが安全なため、無効値は黙って捨てる。
  }
  const byEnvironment = environment === undefined ? undefined : DEFAULT_TRACES_SAMPLE_RATE[environment];
  return byEnvironment ?? FALLBACK_TRACES_SAMPLE_RATE;
}
