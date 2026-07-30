import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import { useApiResource } from "./use-api-resource"
import { ApiError } from "@/lib/api-client"

const mocks = vi.hoisted(() => ({
  reportError: vi.fn(),
}))

// auth-client は import 時に NEXT_PUBLIC_API_URL を要求して throw するため、モジュールごと差し替える
// (api-client がモジュールロード時に apiBaseUrl を読む)
vi.mock("@/lib/auth-client", () => ({
  apiBaseUrl: "http://localhost:8080",
  authClient: { useSession: vi.fn() },
}))

// reportError は内部で Sentry を叩くため、呼び出し検証用にモックする。
// ExpectedError は instanceof 判定に使うので実装をそのまま使う。
vi.mock("@/lib/report-error", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/report-error")>()
  return { ...actual, reportError: mocks.reportError }
})

import { ExpectedError } from "@/lib/report-error"

describe("useApiResource", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("成功時に data を返し、isLoading が false になる", async () => {
    const fetcher = vi.fn().mockResolvedValue({ userCount: 3 })
    const { result } = renderHook(() => useApiResource(fetcher))

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.data).toEqual({ userCount: 3 })
    expect(result.current.error).toBeNull()
    expect(mocks.reportError).not.toHaveBeenCalled()
  })

  it("想定外エラー(500)は error を返し、そのまま reportError へ渡す", async () => {
    const apiError = new ApiError(500)
    const fetcher = vi.fn().mockRejectedValue(apiError)
    const { result } = renderHook(() => useApiResource(fetcher))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.data).toBeUndefined()
    expect(result.current.error).toBe(apiError)
    expect(mocks.reportError).toHaveBeenCalledTimes(1)
    expect(mocks.reportError).toHaveBeenCalledWith(apiError)
  })

  it.each([401, 403])(
    "%i は想定内として ExpectedError に包んで reportError へ渡す",
    async (status) => {
      const apiError = new ApiError(status)
      const fetcher = vi.fn().mockRejectedValue(apiError)
      const { result } = renderHook(() => useApiResource(fetcher))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      // UI にはエラーを返す(呼び出し側でエラー表示するため)
      expect(result.current.error).toBe(apiError)
      expect(mocks.reportError).toHaveBeenCalledTimes(1)
      const reported = mocks.reportError.mock.calls[0]?.[0] as Error
      expect(reported).toBeInstanceOf(ExpectedError)
      expect(reported.cause).toBe(apiError)
    }
  )

  it("ApiError 以外の reject もそのまま reportError へ渡す", async () => {
    const networkError = new Error("network down")
    const fetcher = vi.fn().mockRejectedValue(networkError)
    const { result } = renderHook(() => useApiResource(fetcher))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(mocks.reportError).toHaveBeenCalledWith(networkError)
  })

  it("mapErrorForReporting で監視系へ渡すエラーだけを変換する", async () => {
    const apiError = new ApiError(500, {
      email: "private@example.com",
    })
    const safeError = new ApiError(500)
    const fetcher = vi.fn().mockRejectedValue(apiError)
    const mapErrorForReporting = vi.fn().mockReturnValue(safeError)
    const { result } = renderHook(() =>
      useApiResource(fetcher, { mapErrorForReporting })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.error).toBe(apiError)
    expect(mapErrorForReporting).toHaveBeenCalledWith(apiError)
    expect(mocks.reportError).toHaveBeenCalledWith(safeError)
  })

  it("reload で再取得し、isLoading が再び true になる", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 2 })
    const { result } = renderHook(() => useApiResource(fetcher))

    await waitFor(() => {
      expect(result.current.data).toEqual({ count: 1 })
    })

    act(() => {
      result.current.reload()
    })

    await waitFor(() => {
      expect(result.current.data).toEqual({ count: 2 })
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it("初回が保留中に reload した場合、後から解決した古い応答は新しい値を上書きしない", async () => {
    function deferred<T>() {
      let resolve!: (value: T) => void
      const promise = new Promise<T>((r) => {
        resolve = r
      })
      return { promise, resolve }
    }
    const first = deferred<{ count: number }>()
    const second = deferred<{ count: number }>()
    const fetcher = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const { result } = renderHook(() => useApiResource(fetcher))

    // 初回を解決させないまま再取得させ、古いリクエストを追い越させる
    act(() => {
      result.current.reload()
    })

    await act(async () => {
      second.resolve({ count: 2 })
    })
    expect(result.current.data).toEqual({ count: 2 })

    // 遅れて解決した初回のレスポンスは破棄される
    await act(async () => {
      first.resolve({ count: 1 })
    })
    expect(result.current.data).toEqual({ count: 2 })
    expect(result.current.isLoading).toBe(false)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it("エラー後の reload で成功すれば error がクリアされる", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(500))
      .mockResolvedValueOnce({ ok: true })
    const { result } = renderHook(() => useApiResource(fetcher))

    await waitFor(() => {
      expect(result.current.error).not.toBeNull()
    })

    act(() => {
      result.current.reload()
    })

    await waitFor(() => {
      expect(result.current.data).toEqual({ ok: true })
    })
    expect(result.current.error).toBeNull()
  })

  it("アンマウント後に解決したレスポンスは state を更新しない", async () => {
    let resolve: (value: unknown) => void = () => {}
    const fetcher = vi.fn().mockReturnValue(
      new Promise((r) => {
        resolve = r
      })
    )
    const { result, unmount } = renderHook(() => useApiResource(fetcher))

    unmount()
    resolve({ late: true })
    // React が "unmounted component への setState" 警告を出さないことが実質の検証。
    // 状態はアンマウント前のまま(isLoading: true)であること。
    await Promise.resolve()
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })
})
