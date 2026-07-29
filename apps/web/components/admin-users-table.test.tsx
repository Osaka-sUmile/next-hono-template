import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AdminUsersTable } from "./admin-users-table"

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  reportError: vi.fn(),
  useSession: vi.fn(),
}))

// auth-client は import 時に NEXT_PUBLIC_API_URL を要求して throw するため、モジュールごと差し替える
vi.mock("@/lib/auth-client", () => ({
  apiBaseUrl: "http://localhost:8080",
  authClient: { useSession: mocks.useSession },
}))

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>()
  return {
    ...actual,
    apiClient: { ...actual.apiClient, get: mocks.get, patch: mocks.patch },
  }
})

// reportError は内部で Sentry を叩くため、モックする
vi.mock("@/lib/report-error", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/report-error")>()
  return { ...actual, reportError: mocks.reportError }
})

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user_2",
    email: "member@example.com",
    name: "メンバー",
    role: "user",
    displayName: "メンバーさん",
    image: null,
    emailVerified: true,
    ...overrides,
  }
}

const SELF = makeUser({
  id: "user_1",
  email: "admin@example.com",
  name: "管理者",
  role: "admin",
  displayName: null,
})

function makePage(items: unknown[], total = items.length) {
  return { items, total, limit: 20, offset: 0 }
}

describe("AdminUsersTable", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useSession.mockReturnValue({
      data: { user: { id: "user_1", role: "admin" } },
    })
  })

  it("ユーザーを行として表示し、ロールをバッジで示す", async () => {
    mocks.get.mockResolvedValue(makePage([SELF, makeUser()]))
    render(<AdminUsersTable />)

    // 「一般」「管理者」はロール変更 Select のトリガーにも現れるため、バッジに限定して探す
    const memberRow = (await screen.findByText("member@example.com")).closest(
      "tr"
    ) as HTMLElement
    expect(
      within(memberRow).getByText("一般", { selector: "[data-slot='badge']" })
    ).toBeInTheDocument()
    expect(within(memberRow).getByText("メンバーさん")).toBeInTheDocument()

    const selfRow = screen
      .getByText("admin@example.com")
      .closest("tr") as HTMLElement
    expect(
      within(selfRow).getByText("管理者", { selector: "[data-slot='badge']" })
    ).toBeInTheDocument()
    expect(mocks.get).toHaveBeenCalledWith("/api/v1/admin/users", {
      params: { query: { limit: 20, offset: 0 } },
    })
  })

  it("操作者自身の行は「自分」バッジつきでロール変更が無効", async () => {
    mocks.get.mockResolvedValue(makePage([SELF, makeUser()]))
    render(<AdminUsersTable />)

    const selfRow = (await screen.findByText("admin@example.com")).closest(
      "tr"
    ) as HTMLElement
    expect(within(selfRow).getByText("自分")).toBeInTheDocument()
    expect(
      within(selfRow).getByRole("combobox", {
        name: "admin@example.com のロール",
      })
    ).toBeDisabled()

    const memberRow = screen
      .getByText("member@example.com")
      .closest("tr") as HTMLElement
    expect(
      within(memberRow).getByRole("combobox", {
        name: "member@example.com のロール",
      })
    ).toBeEnabled()
  })

  it("検索入力はデバウンス後に search クエリつきで再取得し、1 ページ目へ戻る", async () => {
    const user = userEvent.setup()
    mocks.get.mockResolvedValue(makePage([makeUser()]))
    render(<AdminUsersTable />)
    await screen.findByText("member@example.com")

    await user.type(
      screen.getByRole("searchbox", { name: "ユーザーを検索" }),
      "tanaka"
    )

    await waitFor(() => {
      expect(mocks.get).toHaveBeenLastCalledWith("/api/v1/admin/users", {
        params: { query: { limit: 20, offset: 0, search: "tanaka" } },
      })
    })
    // 1 文字ごとではなく確定値 1 回のみ(初回 + 確定)
    expect(mocks.get).toHaveBeenCalledTimes(2)
  })

  it("ロールフィルタを変更すると role クエリつきで再取得する", async () => {
    const user = userEvent.setup()
    mocks.get.mockResolvedValue(makePage([makeUser()]))
    render(<AdminUsersTable />)
    await screen.findByText("member@example.com")

    await user.click(screen.getByRole("combobox", { name: "ロールで絞り込み" }))
    await user.click(screen.getByRole("option", { name: "管理者" }))

    await waitFor(() => {
      expect(mocks.get).toHaveBeenLastCalledWith("/api/v1/admin/users", {
        params: { query: { limit: 20, offset: 0, role: "admin" } },
      })
    })
  })

  it("次へで offset を進めて再取得する", async () => {
    const user = userEvent.setup()
    mocks.get.mockResolvedValue(makePage([makeUser()], 45))
    render(<AdminUsersTable />)
    await screen.findByText("1–20 / 45 件")

    await user.click(screen.getByRole("button", { name: "次へ" }))

    await waitFor(() => {
      expect(mocks.get).toHaveBeenLastCalledWith("/api/v1/admin/users", {
        params: { query: { limit: 20, offset: 20 } },
      })
    })
  })

  it("行のロール変更成功で一覧を再取得する", async () => {
    const user = userEvent.setup()
    mocks.get.mockResolvedValue(makePage([makeUser()]))
    mocks.patch.mockResolvedValue({})
    render(<AdminUsersTable />)
    await screen.findByText("member@example.com")

    await user.click(
      screen.getByRole("combobox", { name: "member@example.com のロール" })
    )
    await user.click(screen.getByRole("option", { name: "管理者" }))

    await waitFor(() => {
      expect(mocks.patch).toHaveBeenCalledWith(
        "/api/v1/admin/users/{userId}/role",
        { params: { path: { userId: "user_2" } }, body: { role: "admin" } }
      )
    })
    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalledTimes(2)
    })
  })

  it("検索入力は API の上限(100 文字)までに制限される", async () => {
    mocks.get.mockResolvedValue(makePage([makeUser()]))
    render(<AdminUsersTable />)

    expect(
      await screen.findByRole("searchbox", { name: "ユーザーを検索" })
    ).toHaveAttribute("maxlength", "100")
  })

  it("reload 後に total が現在のページより減ったら最終ページへ巻き戻す", async () => {
    const user = userEvent.setup()
    mocks.get
      // 1 ページ目(offset 0, total 21)
      .mockResolvedValueOnce({
        items: [makeUser()],
        total: 21,
        limit: 20,
        offset: 0,
      })
      // 2 ページ目に進んだ直後、対象がフィルタから外れて total 20 に減った
      .mockResolvedValueOnce({ items: [], total: 20, limit: 20, offset: 20 })
      // 巻き戻し後の 1 ページ目
      .mockResolvedValue(makePage([makeUser()], 20))
    render(<AdminUsersTable />)
    await screen.findByText("1–20 / 21 件")

    await user.click(screen.getByRole("button", { name: "次へ" }))

    await waitFor(() => {
      expect(mocks.get).toHaveBeenLastCalledWith("/api/v1/admin/users", {
        params: { query: { limit: 20, offset: 0 } },
      })
    })
    expect(await screen.findByText("member@example.com")).toBeInTheDocument()
  })

  it("0 件のときは空状態メッセージを表示する", async () => {
    mocks.get.mockResolvedValue(makePage([]))
    render(<AdminUsersTable />)

    expect(
      await screen.findByText("該当するユーザーがいません。")
    ).toBeInTheDocument()
    expect(screen.getByText("0 件")).toBeInTheDocument()
  })

  it("取得失敗でエラーパネルを表示し、再読み込みで復帰する", async () => {
    const user = userEvent.setup()
    mocks.get
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(makePage([makeUser()]))
    render(<AdminUsersTable />)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ユーザー一覧の取得に失敗しました。"
    )
    await user.click(screen.getByRole("button", { name: "再読み込み" }))

    expect(await screen.findByText("member@example.com")).toBeInTheDocument()
  })
})
