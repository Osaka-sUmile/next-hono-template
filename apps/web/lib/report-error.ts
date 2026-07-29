import * as Sentry from "@sentry/nextjs"

/**
 * 想定内エラーのマーカー。
 * これを throw するとSentryへの送信が抑制される。
 * ユーザー操作で当然起きうるエラー（コード不一致・未ログイン等）にのみ使う。
 */
export class ExpectedError extends Error {}

/**
 * catch 節で必ず呼ぶエラー報告関数。
 * ExpectedError 以外は全て Sentry に送る（fail-loud）。
 * 判断に迷うものは印を付けず、送信側に倒すこと。
 */
export function reportError(error: unknown): void {
  if (error instanceof ExpectedError) return
  Sentry.captureException(error)
}
