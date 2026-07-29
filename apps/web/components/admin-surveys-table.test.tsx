import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AdminSurveysTable } from "./admin-surveys-table"

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  reportError: vi.fn(),
}))

// auth-client は import 時に NEXT_PUBLIC_API_URL を要求して throw するため、モジュールごと差し替える
vi.mock("@/lib/auth-client", () => ({
  apiBaseUrl: "http://localhost:8080",
  authClient: { useSession: vi.fn() },
}))

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>()
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      get: mocks.get,
      patch: mocks.patch,
      post: mocks.post,
    },
  }
})

// reportError は内部で Sentry を叩くため、モックする
vi.mock("@/lib/report-error", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/report-error")>()
  return { ...actual, reportError: mocks.reportError }
})

const SURVEYS = {
  items: [
    {
      id: "srv_1",
      slug: "pmf-2026",
      title: "PMF アンケート",
      isActive: true,
      questionCount: 4,
      submissionCount: 128,
      createdAt: "2026-07-01T00:00:00.000Z",
    },
    {
      id: "srv_2",
      slug: "draft-2027",
      title: "下書きアンケート",
      isActive: false,
      questionCount: 0,
      submissionCount: 0,
      createdAt: "2026-07-15T00:00:00.000Z",
    },
  ],
}

describe("AdminSurveysTable", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("一覧を取得して各行にタイトル・slug・件数・有効状態を表示する", async () => {
    mocks.get.mockResolvedValue(SURVEYS)
    render(<AdminSurveysTable />)

    expect(await screen.findByText("PMF アンケート")).toBeInTheDocument()
    expect(mocks.get).toHaveBeenCalledWith("/api/v1/admin/feedback/surveys")

    const rows = screen.getAllByRole("row")
    // ヘッダー行 + データ 2 行
    expect(rows).toHaveLength(3)

    const activeRow = rows[1]!
    expect(within(activeRow).getByText("pmf-2026")).toBeInTheDocument()
    expect(within(activeRow).getByText("4")).toBeInTheDocument()
    expect(within(activeRow).getByText("128")).toBeInTheDocument()
    expect(within(activeRow).getByText("有効")).toBeInTheDocument()
    expect(within(activeRow).getByRole("switch")).toBeChecked()

    const inactiveRow = rows[2]!
    expect(within(inactiveRow).getByText("無効")).toBeInTheDocument()
    expect(within(inactiveRow).getByRole("switch")).not.toBeChecked()
  })

  it("タイトルは詳細ページへのリンクになっている", async () => {
    mocks.get.mockResolvedValue(SURVEYS)
    render(<AdminSurveysTable />)

    const link = await screen.findByRole("link", { name: "PMF アンケート" })
    expect(link).toHaveAttribute("href", "/admin/surveys/srv_1")
  })

  it("空の一覧では空状態メッセージを表示する", async () => {
    mocks.get.mockResolvedValue({ items: [] })
    render(<AdminSurveysTable />)

    expect(
      await screen.findByText(
        "アンケートはまだありません。「アンケートを作成」から追加してください。"
      )
    ).toBeInTheDocument()
  })

  it("取得失敗でエラーパネルを表示し、再読み込みで再取得する", async () => {
    const user = userEvent.setup()
    mocks.get
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(SURVEYS)
    render(<AdminSurveysTable />)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "アンケート一覧の取得に失敗しました。"
    )

    await user.click(screen.getByRole("button", { name: "再読み込み" }))

    expect(await screen.findByText("PMF アンケート")).toBeInTheDocument()
    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalledTimes(2)
    })
  })

  it("有効化スイッチの成功後に一覧を再取得する(同時 1 件の副作用を反映)", async () => {
    const user = userEvent.setup()
    const reloaded = {
      items: [
        { ...SURVEYS.items[0]!, isActive: false },
        {
          ...SURVEYS.items[1]!,
          isActive: true,
          questionCount: 1,
        },
      ],
    }
    mocks.get.mockResolvedValueOnce(SURVEYS).mockResolvedValueOnce(reloaded)
    mocks.patch.mockResolvedValue({})
    render(<AdminSurveysTable />)

    await screen.findByText("PMF アンケート")
    await user.click(
      screen.getByRole("switch", { name: "下書きアンケート を有効化" })
    )

    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalledTimes(2)
    })
    // 再取得後は PMF 側が無効に切り替わる
    const rows = screen.getAllByRole("row")
    expect(within(rows[1]!).getByText("無効")).toBeInTheDocument()
    expect(within(rows[2]!).getByText("有効")).toBeInTheDocument()
  })

  it("作成ダイアログの成功後に一覧を再取得する", async () => {
    const user = userEvent.setup()
    mocks.get.mockResolvedValue(SURVEYS)
    mocks.post.mockResolvedValue({})
    render(<AdminSurveysTable />)

    await screen.findByText("PMF アンケート")
    await user.click(screen.getByRole("button", { name: "アンケートを作成" }))
    await screen.findByRole("dialog")
    await user.type(screen.getByLabelText("タイトル"), "新規アンケート")
    await user.type(screen.getByLabelText("slug"), "new-2027")
    await user.click(screen.getByRole("button", { name: "作成" }))

    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalledTimes(2)
    })
  })
})
