import { beforeEach, describe, expect, it, vi } from "vitest"
import { apiBaseUrl } from "./auth-client"
import { ApiError, apiClient } from "./api-client"

vi.mock("./auth-client", () => ({
  apiBaseUrl: "https://api.example.com",
}))

describe("apiClient", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = fetchMock
  })

  it("apiBaseUrl と path を結合し credentials を付ける", async () => {
    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }))

    await apiClient.get("/api/v1/me")

    expect(fetchMock).toHaveBeenCalledWith(`${apiBaseUrl}/api/v1/me`, {
      method: "GET",
      credentials: "include",
      headers: {},
    })
  })

  it("body があると Content-Type: application/json を付ける", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await apiClient.patch("/api/v1/me", { displayName: "太郎" })

    expect(fetchMock).toHaveBeenCalledWith(`${apiBaseUrl}/api/v1/me`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "太郎" }),
    })
  })

  it("GET には Content-Type を付けない", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await apiClient.get("/health")

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(init.headers).toEqual({})
  })

  it.each([400, 500])(
    "%i 応答で status を保持した ApiError を投げる",
    async (status) => {
      fetchMock.mockResolvedValue(new Response(null, { status }))

      const request = apiClient.get("/api/v1/me")

      await expect(request).rejects.toBeInstanceOf(ApiError)
      await expect(request).rejects.toMatchObject({ status })
    }
  )

  it("204 応答では本文を読み取らない", async () => {
    const text = vi.fn()
    fetchMock.mockResolvedValue({ ok: true, status: 204, text })

    await expect(apiClient.delete("/api/v1/me")).resolves.toBeUndefined()
    expect(text).not.toHaveBeenCalled()
  })

  it("空の本文では undefined を返す", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 200 }))

    await expect(apiClient.get("/health")).resolves.toBeUndefined()
  })

  it("呼び出し側の headers をマージする", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await apiClient.post(
      "/api/v1/me",
      { displayName: "太郎" },
      {
        headers: { "X-Request-Id": "request-id" },
      }
    )

    expect(fetchMock).toHaveBeenCalledWith(
      `${apiBaseUrl}/api/v1/me`,
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": "request-id",
        },
      })
    )
  })
})
