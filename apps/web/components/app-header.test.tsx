import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AppHeader } from "./app-header"

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
}))

// auth-client は import 時に NEXT_PUBLIC_API_URL を要求して throw するため、モジュールごと差し替える
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: mocks.useSession },
}))

// アカウントメニューの挙動は account-menu.test.tsx で検証するため、ここでは存在だけを見る
vi.mock("@/components/account-menu", () => ({
  AccountMenu: () => <div data-testid="account-menu" />,
}))

function makeSession(role: string) {
  return {
    data: {
      user: {
        email: "test@example.com",
        displayName: "テスト太郎",
        role,
      },
      session: {},
    },
    isPending: false,
  }
}

describe("AppHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useSession.mockReturnValue(makeSession("user"))
  })

  it("ハンバーガーを開くとナビに『ダッシュボード』リンクが表示される", async () => {
    const user = userEvent.setup()
    render(<AppHeader />)

    await user.click(screen.getByRole("button", { name: "メニュー" }))

    expect(
      await screen.findByRole("link", { name: "ダッシュボード" })
    ).toBeInTheDocument()
  })

  it("アカウントメニューを描画する", () => {
    render(<AppHeader />)

    expect(screen.getByTestId("account-menu")).toBeInTheDocument()
  })

  it("一般ユーザーには『管理画面』リンクを表示しない", async () => {
    const user = userEvent.setup()
    render(<AppHeader />)

    await user.click(screen.getByRole("button", { name: "メニュー" }))
    await screen.findByRole("link", { name: "ダッシュボード" })

    expect(
      screen.queryByRole("link", { name: "管理画面" })
    ).not.toBeInTheDocument()
  })

  it("admin には『管理画面』リンクを表示する", async () => {
    const user = userEvent.setup()
    mocks.useSession.mockReturnValue(makeSession("admin"))
    render(<AppHeader />)

    await user.click(screen.getByRole("button", { name: "メニュー" }))

    const adminLink = await screen.findByRole("link", { name: "管理画面" })
    expect(adminLink).toHaveAttribute("href", "/admin")
  })
})
