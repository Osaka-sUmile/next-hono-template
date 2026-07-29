import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { AuthGuard } from "./auth-guard"

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  replace: vi.fn(),
}))

// auth-client は import 時に NEXT_PUBLIC_API_URL を要求して throw するため、モジュールごと差し替える
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: mocks.useSession },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, push: vi.fn() }),
}))

describe("AuthGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("判定中はローディングを表示し、children を描画しない", () => {
    mocks.useSession.mockReturnValue({ data: null, isPending: true })
    render(
      <AuthGuard>
        <div>保護コンテンツ</div>
      </AuthGuard>
    )

    expect(screen.getByText("読み込み中...")).toBeInTheDocument()
    expect(screen.queryByText("保護コンテンツ")).not.toBeInTheDocument()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it("未認証なら /login にリダイレクトし、children を描画しない", async () => {
    mocks.useSession.mockReturnValue({ data: null, isPending: false })
    render(
      <AuthGuard>
        <div>保護コンテンツ</div>
      </AuthGuard>
    )

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/login")
    })
    expect(screen.queryByText("保護コンテンツ")).not.toBeInTheDocument()
  })

  it("認証済みなら children を描画し、リダイレクトしない", () => {
    mocks.useSession.mockReturnValue({
      data: { user: { email: "a@example.com" }, session: {} },
      isPending: false,
    })
    render(
      <AuthGuard>
        <div>保護コンテンツ</div>
      </AuthGuard>
    )

    expect(screen.getByText("保護コンテンツ")).toBeInTheDocument()
    expect(mocks.replace).not.toHaveBeenCalled()
  })
})
