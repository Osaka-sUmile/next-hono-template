"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ApiError } from "@/lib/api-client"
import { ExpectedError, reportError } from "@/lib/report-error"

type ApiResourceResult<T> = {
  version: number
  data: T | undefined
  error: unknown
}

/**
 * admin 画面向けの共通データ取得フック。`apiClient` の呼び出しを包み、
 * `{ data, error, isLoading, reload }` を返す。
 *
 * エラー方針をここに一元化する:
 * - 401/403 は「非 admin が URL を直打ちした」等の想定内なので `ExpectedError` に
 *   包んで `reportError` へ渡す(= Sentry 送信は抑制、UI にはエラーを返す)。
 * - それ以外は `reportError` にそのまま渡して Sentry へ送る(fail-loud)。
 *
 * React 19 の StrictMode 二重 effect や reload 連打で古いレスポンスが
 * 新しい state を上書きしないよう、effect の cleanup フラグで結果を破棄する。
 * `isLoading` / `error` は「現在の version に対応する結果があるか」から派生させ、
 * effect 本体では setState しない(react-hooks/set-state-in-effect 対応)。
 *
 * `fetcher` は ref 経由で最新を参照するため、呼び出し側はインライン関数を
 * そのまま渡してよい(再レンダーで再取得は走らない)。再取得は `reload()` のみ。
 */
export function useApiResource<T>(fetcher: () => Promise<T>): {
  data: T | undefined
  error: unknown
  isLoading: boolean
  reload: () => void
} {
  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  })

  const [version, setVersion] = useState(0)
  const [result, setResult] = useState<ApiResourceResult<T> | null>(null)

  useEffect(() => {
    let cancelled = false

    fetcherRef.current().then(
      (data) => {
        if (cancelled) return
        setResult({ version, data, error: null })
      },
      (error: unknown) => {
        if (cancelled) return
        const isExpected =
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403)
        reportError(
          isExpected
            ? new ExpectedError("admin resource access denied", {
                cause: error,
              })
            : error
        )
        setResult({ version, data: undefined, error })
      }
    )

    return () => {
      cancelled = true
    }
  }, [version])

  const reload = useCallback(() => {
    setVersion((v) => v + 1)
  }, [])

  const isCurrent = result !== null && result.version === version
  return {
    data: isCurrent ? result.data : undefined,
    error: isCurrent ? result.error : null,
    isLoading: !isCurrent,
    reload,
  }
}
