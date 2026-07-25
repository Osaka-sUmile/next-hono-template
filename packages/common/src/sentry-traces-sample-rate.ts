/**
 * 環境ごとの tracesSampleRate の既定値。
 *
 * トランザクション（1 リクエストや 1 ページ遷移の所要時間の記録）はエラーと違い正常時も
 * 毎回発生するため、全件送るとクォータを消費する。本番はサンプリングし、トラフィックの
 * 少ない preview は少し高め、ローカル開発は全件にする。
 *
 * 値を変えるときは `docs/deployment.md`「Sentry のトレーシングとサンプリング方針」の表も
 * 合わせて更新すること。
 */
const DEFAULT_TRACES_SAMPLE_RATE: Record<string, number> = {
  production: 0.1,
  preview: 0.2,
};

/** 既知の環境名に当てはまらない場合（development / 未設定など）の既定値。 */
const FALLBACK_TRACES_SAMPLE_RATE = 1;

/**
 * Sentry の environment を決める。
 *
 * API の Worker binding は検証前の unknown、web の process.env は string | undefined なので、
 * 両方を受けられるようにする。空文字・空白のみ・非文字列は未設定として扱い、優先値が
 * 無効なら fallback を使う。
 */
export function resolveSentryEnvironment(preferred: unknown, fallback: unknown): string | undefined {
  const normalize = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  };

  return normalize(preferred) ?? normalize(fallback);
}

/**
 * Sentry の tracesSampleRate を決める。
 *
 * api（`@sentry/cloudflare`）と web（`@sentry/nextjs`）の両方から使う単一のソース。
 * この関数は文字列と数値だけを扱う純関数で Sentry SDK には依存しないため、SDK の違い
 * （api は `@sentry/cloudflare`、web は `@sentry/nextjs`）は共有の障害にならない。
 *
 * @param rawValue 運用で率を上書きしたいときのみ設定する値（例: `SENTRY_TRACES_SAMPLE_RATE`）。
 *   `0` と `1` は有効な指定なので、falsy 判定ではなく範囲（0 以上 1 以下）で判定する。
 *   無効値（非数値・範囲外・空文字・空白のみ）は「設定ミスでトレースを失うより既定値で
 *   動くほうが安全」なため黙って捨て、環境既定値にフォールバックする。
 * @param environment 環境名（`production` / `preview` など）。未設定や未知の環境名は
 *   フォールバック値（全件送信）を使う。
 */
export function resolveTracesSampleRate(
  rawValue: string | undefined,
  environment: string | undefined,
): number {
  const trimmed = rawValue?.trim();
  if (trimmed !== undefined && trimmed !== "") {
    const parsed = Number(trimmed);
    // 0 と 1 は有効な指定なので、falsy 判定ではなく範囲で判定する。
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) return parsed;
    // 設定ミスでトレースを失うより既定値で動くほうが安全なため、無効値は黙って捨てる。
  }
  const byEnvironment = environment === undefined ? undefined : DEFAULT_TRACES_SAMPLE_RATE[environment];
  return byEnvironment ?? FALLBACK_TRACES_SAMPLE_RATE;
}
