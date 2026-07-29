import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { SidebarProvider } from "@workspace/ui/components/sidebar"
import { AdminSidebar } from "./admin-sidebar"

const mocks = vi.hoisted(() => ({
  usePathname: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: mocks.usePathname,
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

function renderSidebar(pathname: string) {
  mocks.usePathname.mockReturnValue(pathname)
  return render(
    <SidebarProvider>
      <AdminSidebar />
    </SidebarProvider>
  )
}

describe("AdminSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("ナビ 3 項目とアプリへ戻るリンクを表示する", () => {
    renderSidebar("/admin")

    expect(
      screen.getByRole("link", { name: "ダッシュボード" })
    ).toHaveAttribute("href", "/admin")
    expect(screen.getByRole("link", { name: "ユーザー" })).toHaveAttribute(
      "href",
      "/admin/users"
    )
    expect(screen.getByRole("link", { name: "アンケート" })).toHaveAttribute(
      "href",
      "/admin/surveys"
    )
    expect(screen.getByRole("link", { name: "アプリへ戻る" })).toHaveAttribute(
      "href",
      "/dashboard"
    )
  })

  it("/admin ではダッシュボードのみアクティブになる", () => {
    renderSidebar("/admin")

    expect(
      screen.getByRole("link", { name: "ダッシュボード" })
    ).toHaveAttribute("data-active", "true")
    expect(screen.getByRole("link", { name: "ユーザー" })).toHaveAttribute(
      "data-active",
      "false"
    )
  })

  it("/admin/surveys/xxx でも親のアンケート項目がアクティブになる", () => {
    renderSidebar("/admin/surveys/survey_1")

    expect(screen.getByRole("link", { name: "アンケート" })).toHaveAttribute(
      "data-active",
      "true"
    )
    // /admin は完全一致のみなのでアクティブにならない
    expect(
      screen.getByRole("link", { name: "ダッシュボード" })
    ).toHaveAttribute("data-active", "false")
  })
})
