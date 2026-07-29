import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { AdminGuard } from "./admin-guard"

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

function makeSession(role: string) {
  return {
    data: {
      user: { email: "test@example.com", role },
      session: {},
    },
    isPending: false,
  }
}

describe("AdminGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("判定中はローディングを表示し、children を描画しない", () => {
    mocks.useSession.mockReturnValue({ data: null, isPending: true })
    render(
      <AdminGuard>
        <div>管理コンテンツ</div>
      </AdminGuard>
    )

    expect(screen.getByText("読み込み中...")).toBeInTheDocument()
    expect(screen.queryByText("管理コンテンツ")).not.toBeInTheDocument()
  })

  it("未認証なら /login にリダイレクトし、children を描画しない", async () => {
    mocks.useSession.mockReturnValue({ data: null, isPending: false })
    render(
      <AdminGuard>
        <div>管理コンテンツ</div>
      </AdminGuard>
    )

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/login")
    })
    expect(screen.queryByText("管理コンテンツ")).not.toBeInTheDocument()
  })

  it("認証済みでも role が user なら 403 パネルを表示し、children を描画しない", () => {
    mocks.useSession.mockReturnValue(makeSession("user"))
    render(
      <AdminGuard>
        <div>管理コンテンツ</div>
      </AdminGuard>
    )

    expect(screen.getByText("アクセス権限がありません")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "ダッシュボードへ戻る" })
    ).toHaveAttribute("href", "/dashboard")
    expect(screen.queryByText("管理コンテンツ")).not.toBeInTheDocument()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it("admin なら children を描画する", () => {
    mocks.useSession.mockReturnValue(makeSession("admin"))
    render(
      <AdminGuard>
        <div>管理コンテンツ</div>
      </AdminGuard>
    )

    expect(screen.getByText("管理コンテンツ")).toBeInTheDocument()
    expect(
      screen.queryByText("アクセス権限がありません")
    ).not.toBeInTheDocument()
    expect(mocks.replace).not.toHaveBeenCalled()
  })
})
