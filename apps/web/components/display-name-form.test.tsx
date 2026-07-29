import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import * as Sentry from "@sentry/nextjs"
import { ApiError } from "@/lib/api-client"
import { DisplayNameForm } from "./display-name-form"

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  patch: vi.fn(),
}))

vi.mock("@/lib/auth-client", () => ({
  // api-client.ts がモジュール読み込み時に openapi-fetch の createClient() へ渡すため必要。
  // 実際の fetch 呼び出しは apiClient.patch 自体をモックしているため値そのものは使われない。
  apiBaseUrl: "http://localhost:8080",
  authClient: {
    useSession: () => ({ refetch: mocks.refetch }),
  },
}))

// apiClient のみ差し替え、ApiError は実体を使う（instanceof 判定を本物で検証するため）。
// fetch の詳細（baseUrl / credentials / Content-Type）は lib/api-client.test.ts が担う。
vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiClient: { patch: mocks.patch },
}))

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}))

describe("DisplayNameForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // api-client のアダプターは成功時の data を直接返す。
    mocks.patch.mockResolvedValue(undefined)
  })

  it("保存成功時に api-client 経由で PATCH を呼び refetch して成功メッセージを表示する", async () => {
    render(<DisplayNameForm initialDisplayName="" />)

    fireEvent.change(screen.getByLabelText("表示名"), {
      target: { value: "太郎" },
    })
    fireEvent.click(screen.getByRole("button", { name: "表示名を保存" }))

    await waitFor(() => {
      expect(mocks.patch).toHaveBeenCalledWith("/api/v1/me", {
        body: { displayName: "太郎" },
      })
    })
    expect(mocks.refetch).toHaveBeenCalled()
    expect(await screen.findByText("保存しました。")).toBeInTheDocument()
  })

  it("前後の空白は trim して送る", async () => {
    render(<DisplayNameForm initialDisplayName="" />)

    fireEvent.change(screen.getByLabelText("表示名"), {
      target: { value: "  太郎  " },
    })
    fireEvent.click(screen.getByRole("button", { name: "表示名を保存" }))

    await waitFor(() => {
      expect(mocks.patch).toHaveBeenCalledWith("/api/v1/me", {
        body: { displayName: "太郎" },
      })
    })
  })

  it("空入力を保存すると displayName を null で送る", async () => {
    render(<DisplayNameForm initialDisplayName="既存" />)

    fireEvent.change(screen.getByLabelText("表示名"), { target: { value: "" } })
    fireEvent.click(screen.getByRole("button", { name: "表示名を保存" }))

    await waitFor(() => {
      expect(mocks.patch).toHaveBeenCalledWith("/api/v1/me", {
        body: { displayName: null },
      })
    })
  })

  it("500 応答時はエラーメッセージを表示し refetch せず Sentry に送る", async () => {
    mocks.patch.mockRejectedValue(new ApiError(500))
    render(<DisplayNameForm initialDisplayName="既存" />)

    fireEvent.click(screen.getByRole("button", { name: "表示名を保存" }))

    expect(
      await screen.findByText(
        "表示名の更新に失敗しました。ログイン済みか確認してください。"
      )
    ).toBeInTheDocument()
    expect(mocks.refetch).not.toHaveBeenCalled()
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalled()
  })

  it("401 応答時はエラーメッセージを表示し refetch せず Sentry に送らない", async () => {
    mocks.patch.mockRejectedValue(new ApiError(401))
    render(<DisplayNameForm initialDisplayName="既存" />)

    fireEvent.click(screen.getByRole("button", { name: "表示名を保存" }))

    expect(
      await screen.findByText(
        "表示名の更新に失敗しました。ログイン済みか確認してください。"
      )
    ).toBeInTheDocument()
    expect(mocks.refetch).not.toHaveBeenCalled()
    expect(vi.mocked(Sentry.captureException)).not.toHaveBeenCalled()
  })

  it("400 応答時も想定内として Sentry に送らない", async () => {
    mocks.patch.mockRejectedValue(new ApiError(400))
    render(<DisplayNameForm initialDisplayName="既存" />)

    fireEvent.click(screen.getByRole("button", { name: "表示名を保存" }))

    expect(
      await screen.findByText(
        "表示名の更新に失敗しました。ログイン済みか確認してください。"
      )
    ).toBeInTheDocument()
    expect(vi.mocked(Sentry.captureException)).not.toHaveBeenCalled()
  })

  it("ApiError 以外（通信断など）は想定外として Sentry に送る", async () => {
    mocks.patch.mockRejectedValue(new TypeError("Failed to fetch"))
    render(<DisplayNameForm initialDisplayName="既存" />)

    fireEvent.click(screen.getByRole("button", { name: "表示名を保存" }))

    expect(
      await screen.findByText(
        "表示名の更新に失敗しました。ログイン済みか確認してください。"
      )
    ).toBeInTheDocument()
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalled()
  })

  it("refetch 失敗時も保存成功メッセージを表示し refetch エラーを Sentry に送る", async () => {
    mocks.refetch.mockRejectedValueOnce(new Error("refetch failed"))
    render(<DisplayNameForm initialDisplayName="既存" />)

    fireEvent.change(screen.getByLabelText("表示名"), {
      target: { value: "新しい名前" },
    })
    fireEvent.click(screen.getByRole("button", { name: "表示名を保存" }))

    expect(await screen.findByText("保存しました。")).toBeInTheDocument()
    expect(mocks.refetch).toHaveBeenCalled()
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalled()
    expect(vi.mocked(Sentry.captureException).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ message: "refetch failed" })
    )
  })
})
