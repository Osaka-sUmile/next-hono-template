/**
 * Cloudflare Workers ランタイムでは pino (Node 専用 API に依存) が使えないため、
 * console ベースの薄いロガーに置き換える。
 * 呼び出し側は `logger.info(obj, msg)` のように pino と同じ引数順で呼べるよう、
 * 第1引数に付随情報のオブジェクト、第2引数にメッセージを受け取る。
 */
type LogFn = (obj: unknown, msg?: string) => void

function log(consoleFn: (...args: unknown[]) => void): LogFn {
  return (obj, msg) => {
    if (msg === undefined) {
      consoleFn(obj)
      return
    }
    consoleFn(msg, obj)
  }
}

export const logger = {
  info: log(console.info),
  error: log(console.error),
  debug: log(console.debug),
  warn: log(console.warn),
}
