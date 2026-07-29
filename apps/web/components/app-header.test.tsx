import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AppHeader } from "./app-header"

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
  replace: vi.fn(),
  setTheme: vi.fn(),
  reportError: vi.fn(),
}))

// auth-client は import 時に NEXT_PUBLIC_API_URL を要求して throw するため、モジュールごと差し替える
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: mocks.useSession,
    signOut: mocks.signOut,
  },
}))

// reportError は内部で Sentry を叩くため、呼び出し検証用にモックする
vi.mock("@/lib/report-error", () => ({
  reportError: mocks.reportError,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, push: vi.fn() }),
}))

vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme: mocks.setTheme }),
}))

const SESSION = {
  data: {
    user: {
      email: "test@example.com",
      displayName: "テスト太郎",
      role: "user",
    },
    session: {},
  },
  isPending: false,
}

describe("AppHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useSession.mockReturnValue(SESSION)
  })

  it("ハンバーガーを開くとナビに『ダッシュボード』リンクが表示される", async () => {
    const user = userEvent.setup()
    render(<AppHeader />)

    await user.click(screen.getByRole("button", { name: "メニュー" }))

    expect(
      await screen.findByRole("link", { name: "ダッシュボード" })
    ).toBeInTheDocument()
  })

  it("アカウントメニューに表示名・メール・各項目が表示される", async () => {
    const user = userEvent.setup()
    render(<AppHeader />)

    await user.click(screen.getByRole("button", { name: "アカウントメニュー" }))

    expect(await screen.findByText("テスト太郎")).toBeInTheDocument()
    expect(screen.getByText("test@example.com")).toBeInTheDocument()
    expect(
      screen.getByRole("menuitem", { name: "メールアドレス変更" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("menuitem", { name: "ログアウト" })
    ).toBeInTheDocument()
  })

  it("ログアウト成功で signOut を呼び /login に遷移する", async () => {
    const user = userEvent.setup()
    mocks.signOut.mockResolvedValue({ data: { success: true }, error: null })
    render(<AppHeader />)

    await user.click(screen.getByRole("button", { name: "アカウントメニュー" }))
    await user.click(
      await screen.findByRole("menuitem", { name: "ログアウト" })
    )

    await waitFor(() => {
      expect(mocks.signOut).toHaveBeenCalled()
      expect(mocks.replace).toHaveBeenCalledWith("/login")
    })
  })

  it("ログアウト失敗でエラーを表示し、遷移しない", async () => {
    const user = userEvent.setup()
    mocks.signOut.mockResolvedValue({
      data: null,
      error: { status: 500, statusText: "Internal Server Error" },
    })
    render(<AppHeader />)

    await user.click(screen.getByRole("button", { name: "アカウントメニュー" }))
    await user.click(
      await screen.findByRole("menuitem", { name: "ログアウト" })
    )

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ログアウトに失敗しました。"
    )
    expect(mocks.replace).not.toHaveBeenCalled()
    // 戻り値の { error } は想定内エラーなので Sentry へは送らない
    expect(mocks.reportError).not.toHaveBeenCalled()
  })

  it("ログアウトが reject したらエラーを表示し reportError を呼び、遷移しない", async () => {
    const user = userEvent.setup()
    mocks.signOut.mockRejectedValue(new Error("network down"))
    render(<AppHeader />)

    await user.click(screen.getByRole("button", { name: "アカウントメニュー" }))
    await user.click(
      await screen.findByRole("menuitem", { name: "ログアウト" })
    )

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ログアウトに失敗しました。"
    )
    // reject(想定外エラー)は Sentry へ送る
    await waitFor(() => {
      expect(mocks.reportError).toHaveBeenCalledTimes(1)
    })
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it("外観サブメニューからテーマを切り替えられる", async () => {
    const user = userEvent.setup()
    render(<AppHeader />)

    await user.click(screen.getByRole("button", { name: "アカウントメニュー" }))
    // Radix のサブメニューは hover(pointer 移動)で開く
    await user.hover(await screen.findByRole("menuitem", { name: "外観" }))
    // jsdom ではサブメニュー項目への pointer クリックが座標判定で弾かれるため、
    // onClick 配線の検証には fireEvent を使う(開閉挙動自体は e2e で担保)
    fireEvent.click(await screen.findByRole("menuitem", { name: "ダーク" }))

    expect(mocks.setTheme).toHaveBeenCalledWith("dark")
  })
})
