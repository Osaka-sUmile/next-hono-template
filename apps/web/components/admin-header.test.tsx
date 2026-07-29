import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { SidebarProvider } from "@workspace/ui/components/sidebar"
import { AdminHeader } from "./admin-header"

const mocks = vi.hoisted(() => ({
  usePathname: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: mocks.usePathname,
}))

// アカウントメニューの挙動は account-menu.test.tsx で検証するため、ここでは存在だけを見る
vi.mock("@/components/account-menu", () => ({
  AccountMenu: () => <div data-testid="account-menu" />,
}))

// jsdom は matchMedia を実装していない(sidebar の useIsMobile が使用)
beforeEach(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
})

function renderHeader(pathname: string) {
  mocks.usePathname.mockReturnValue(pathname)
  return render(
    <SidebarProvider>
      <AdminHeader />
    </SidebarProvider>
  )
}

describe("AdminHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("サイドバートグルとアカウントメニューを表示する", () => {
    renderHeader("/admin")

    expect(
      screen.getByRole("button", { name: "Toggle Sidebar" })
    ).toBeInTheDocument()
    expect(screen.getByTestId("account-menu")).toBeInTheDocument()
  })

  it.each([
    ["/admin", "ダッシュボード"],
    ["/admin/users", "ユーザー"],
    ["/admin/surveys", "アンケート"],
    ["/admin/surveys/survey_1", "アンケート"],
  ])("%s ではタイトルに『%s』を表示する", (pathname, title) => {
    renderHeader(pathname)

    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument()
  })
})
