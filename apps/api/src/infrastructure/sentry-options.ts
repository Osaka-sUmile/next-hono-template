import type { WorkerBindings } from "./env";

/**
 * 環境ごとの tracesSampleRate の既定値。
 *
 * トランザクション（1 リクエストの所要時間の記録）はエラーと違い正常時も毎回発生するため、
 * 全件送るとクォータを消費し CPU も僅かに食う。本番はサンプリングし、トラフィックの少ない
 * preview は少し高め、ローカル開発は全件にする。
 *
 * 値をここ（コード側）に持つ理由: wrangler.jsonc の `vars` は env に継承されないため、
 * キーを増やすと top-level / preview / production の 3 箇所に書く保守負債が増える。
 * 運用で率を変えたいときだけ `SENTRY_TRACES_SAMPLE_RATE` で上書きできるようにしてある。
 *
 * 同じテーブルと解釈ロジックが web 側（apps/web/lib/sentry-traces-sample-rate.ts）にも
 * ある。共通パッケージを新設するコストを避けて意図的に重複させているため、値を変えるときは
 * 両方と docs/deployment.md を合わせること（理由の詳細は web 側のコメントに記載）。
 */
const DEFAULT_TRACES_SAMPLE_RATE: Record<string, number> = {
  production: 0.1,
  preview: 0.2,
};

/** 既知の環境名に当てはまらない場合（development / 未設定など）の既定値。 */
const FALLBACK_TRACES_SAMPLE_RATE = 1;

export type SentryOptions = {
  dsn: string;
  environment: string | undefined;
  tracesSampleRate: number;
};

/** 検証前の生 binding から、空文字・空白のみ・非文字列を除いた値を取り出す。 */
function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function resolveTracesSampleRate(rawValue: unknown, environment: string | undefined): number {
  const override = readNonEmptyString(rawValue);
  if (override !== undefined) {
    const parsed = Number(override);
    // 0 と 1 は有効な指定なので、falsy 判定ではなく範囲で判定する。
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) return parsed;
    // 設定ミスでトレースを失うより既定値で動くほうが安全なため、無効値は黙って捨てる。
  }
  const byEnvironment = environment === undefined ? undefined : DEFAULT_TRACES_SAMPLE_RATE[environment];
  return byEnvironment ?? FALLBACK_TRACES_SAMPLE_RATE;
}

/**
 * `Sentry.withSentry` に渡すオプションを組み立てる。
 *
 * 引数は **検証前の生 binding**。`withSentry` のコールバックは `parseEnv` を通す前の
 * env を受け取るため、envSchema (env.ts) に項目を足してもここからは使えない。
 * 二重の検証経路を作らないよう、Sentry 関連の値はこの関数だけで解釈する。
 *
 * SENTRY_DSN が未設定なら undefined を返し、Sentry を無効のままにする
 * （ローカル開発などで本番 Sentry にノイズを送らないため）。
 */
export function resolveSentryOptions(rawEnv: WorkerBindings): SentryOptions | undefined {
  const dsn = readNonEmptyString(rawEnv.SENTRY_DSN);
  if (dsn === undefined) return undefined;

  // preview / production はどちらも NODE_ENV=production のため、環境の識別には
  // SENTRY_ENVIRONMENT (wrangler.jsonc の env ごとの vars) を優先する。
  const environment =
    readNonEmptyString(rawEnv.SENTRY_ENVIRONMENT) ?? readNonEmptyString(rawEnv.NODE_ENV);

  return {
    dsn,
    environment,
    tracesSampleRate: resolveTracesSampleRate(rawEnv.SENTRY_TRACES_SAMPLE_RATE, environment),
  };
}
