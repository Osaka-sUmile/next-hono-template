import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AdminSummaryChart } from "./admin-summary-chart"

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  reportError: vi.fn(),
}))

vi.mock("@/lib/auth-client", () => ({
  apiBaseUrl: "http://localhost:8080",
  authClient: { useSession: vi.fn() },
}))

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>()
  return { ...actual, apiClient: { ...actual.apiClient, get: mocks.get } }
})

vi.mock("@/lib/report-error", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/report-error")>()
  return { ...actual, reportError: mocks.reportError }
})

const SURVEY = {
  id: "survey-1",
  slug: "pmf-2026",
  title: "PMF アンケート",
  isActive: true,
  createdAt: "2026-07-01T00:00:00.000Z",
  questions: [
    {
      id: "question-1",
      type: "single_choice" as const,
      text: "おすすめ度を教えてください",
      required: true,
      sortOrder: 0,
      choices: [
        { value: "yes", label: "はい", sortOrder: 0 },
        { value: "no", label: "いいえ", sortOrder: 1 },
      ],
    },
    {
      id: "question-2",
      type: "text" as const,
      text: "理由を教えてください",
      required: false,
      sortOrder: 1,
      choices: [],
    },
  ],
}

const SUMMARY = {
  surveyId: "survey-1",
  respondentCount: 3,
  tallies: [{ questionId: "question-1", choiceValue: "yes", count: 3 }],
}

function mockSuccessfulRequests() {
  mocks.get.mockImplementation((path: string) => {
    if (path.endsWith("/summary")) return Promise.resolve(SUMMARY)
    return Promise.resolve(SURVEY)
  })
}

describe("AdminSummaryChart", () => {
  let boundingRectSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    // jsdom にはレイアウト計算がないため、ResponsiveContainer が実寸を取得できるよう
    // このテストで描画するチャートの明示寸法を返す。
    boundingRectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({
        bottom: 256,
        height: 256,
        left: 0,
        right: 480,
        top: 0,
        width: 480,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      })
  })

  afterEach(() => {
    boundingRectSpy.mockRestore()
  })

  it("詳細と集計を join し、0 件の選択肢も代替表現に表示する", async () => {
    mockSuccessfulRequests()
    render(<AdminSummaryChart surveyId="survey-1" />)

    expect(
      await screen.findByRole("heading", { name: "PMF アンケート" })
    ).toBeInTheDocument()
    expect(screen.getByText("回答者数 3 人")).toBeInTheDocument()
    expect(
      screen.getByText("集計は各ユーザーの最新提出のみを数えています。")
    ).toBeInTheDocument()

    const accessibleSummary =
      screen.getByLabelText("おすすめ度を教えてくださいの回答数")
    expect(within(accessibleSummary).getByText("はい")).toBeInTheDocument()
    expect(within(accessibleSummary).getByText("3 件")).toBeInTheDocument()
    expect(within(accessibleSummary).getByText("いいえ")).toBeInTheDocument()
    expect(within(accessibleSummary).getByText("0 件")).toBeInTheDocument()
    expect(screen.queryByText("理由を教えてください")).not.toBeInTheDocument()

    expect(mocks.get).toHaveBeenCalledWith(
      "/api/v1/admin/feedback/surveys/{surveyId}",
      { params: { path: { surveyId: "survey-1" } } }
    )
    expect(mocks.get).toHaveBeenCalledWith("/api/v1/admin/feedback/summary", {
      params: { query: { surveyId: "survey-1" } },
    })
  })

  it("取得失敗を表示し、再読み込みで復帰する", async () => {
    const user = userEvent.setup()
    mocks.get.mockRejectedValue(new Error("boom"))
    render(<AdminSummaryChart surveyId="survey-1" />)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "アンケート集計の取得に失敗しました。"
    )

    mockSuccessfulRequests()
    await user.click(screen.getByRole("button", { name: "再読み込み" }))

    expect(
      await screen.findByRole("heading", { name: "PMF アンケート" })
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalledTimes(4)
    })
  })
})
