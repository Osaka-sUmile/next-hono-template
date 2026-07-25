import { resolveTracesSampleRate } from "@workspace/common";
import type { WorkerBindings } from "./env";

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

/**
 * `Sentry.withSentry` に渡すオプションを組み立てる。
 *
 * 引数は **検証前の生 binding**。`withSentry` のコールバックは `parseEnv` を通す前の
 * env を受け取るため、envSchema (env.ts) に項目を足してもここからは使えない。
 * 二重の検証経路を作らないよう、Sentry 関連の値はこの関数だけで解釈する。
 *
 * SENTRY_DSN が未設定なら undefined を返し、Sentry を無効のままにする
 * （ローカル開発などで本番 Sentry にノイズを送らないため）。
 *
 * tracesSampleRate の解釈（環境別の既定値・上書き値のバリデーション）は
 * `@workspace/common` の `resolveTracesSampleRate` に集約している（web 側と共有する
 * 単一のソース）。この関数は `string | undefined` しか受け取らないため、検証前の
 * 生 binding（`unknown`）を渡せる形に変換するのは api 側の責務として `readNonEmptyString`
 * を通す。
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
    tracesSampleRate: resolveTracesSampleRate(
      readNonEmptyString(rawEnv.SENTRY_TRACES_SAMPLE_RATE),
      environment,
    ),
  };
}
