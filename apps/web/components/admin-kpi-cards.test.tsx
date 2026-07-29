import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AdminKpiCards } from "./admin-kpi-cards"

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  reportError: vi.fn(),
}))

// auth-client は import 時に NEXT_PUBLIC_API_URL を要求して throw するため、モジュールごと差し替える
vi.mock("@/lib/auth-client", () => ({
  apiBaseUrl: "http://localhost:8080",
  authClient: { useSession: vi.fn() },
}))

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>()
  return { ...actual, apiClient: { ...actual.apiClient, get: mocks.get } }
})

// reportError は内部で Sentry を叩くため、モックする
vi.mock("@/lib/report-error", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/report-error")>()
  return { ...actual, reportError: mocks.reportError }
})

const SUMMARY = {
  userCount: 1234,
  adminCount: 2,
  surveyCount: 5,
  activeSurveyCount: 1,
  submissionCount: 321,
  submissionCountLast7Days: 45,
}

describe("AdminKpiCards", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("取得成功で 6 つの KPI をラベルと値つきで表示する", async () => {
    mocks.get.mockResolvedValue(SUMMARY)
    render(<AdminKpiCards />)

    expect(await screen.findByText("ユーザー数")).toBeInTheDocument()
    expect(screen.getByText("1,234")).toBeInTheDocument()
    expect(screen.getByText("管理者数")).toBeInTheDocument()
    expect(screen.getByText("アンケート数")).toBeInTheDocument()
    expect(screen.getByText("有効なアンケート")).toBeInTheDocument()
    expect(screen.getByText("総回答数")).toBeInTheDocument()
    expect(screen.getByText("321")).toBeInTheDocument()
    expect(screen.getByText("直近7日の回答数")).toBeInTheDocument()
    expect(screen.getByText("45")).toBeInTheDocument()
    expect(mocks.get).toHaveBeenCalledWith("/api/v1/admin/summary")
  })

  it("取得失敗でエラーパネルを表示する", async () => {
    mocks.get.mockRejectedValue(new Error("boom"))
    render(<AdminKpiCards />)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "サマリーの取得に失敗しました。"
    )
  })

  it("エラーパネルの再読み込みで再取得し、成功したら KPI を表示する", async () => {
    const user = userEvent.setup()
    mocks.get
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(SUMMARY)
    render(<AdminKpiCards />)

    await screen.findByRole("alert")
    await user.click(screen.getByRole("button", { name: "再読み込み" }))

    expect(await screen.findByText("ユーザー数")).toBeInTheDocument()
    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalledTimes(2)
    })
  })
})
