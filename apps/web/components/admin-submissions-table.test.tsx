import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AdminSubmissionsTable } from "./admin-submissions-table"
import { ApiError } from "@/lib/api-client"

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

function makeSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: "submission-1",
    surveyId: "survey-1",
    user: {
      id: "user-1",
      email: "respondent@example.com",
      name: "回答 太郎",
      displayName: "たろう",
    },
    createdAt: "2026-07-15T03:30:00.000Z",
    answers: [
      {
        questionId: "question-1",
        questionText: "おすすめ度を教えてください",
        choiceValue: "yes",
        choiceLabel: "はい",
        textValue: null,
      },
      {
        questionId: "question-2",
        questionText: "理由を教えてください",
        choiceValue: null,
        choiceLabel: null,
        textValue: "操作が分かりやすかったです。",
      },
    ],
    ...overrides,
  }
}

function makePage(items: unknown[], total = items.length, offset = 0) {
  return { items, total, limit: 20, offset }
}

describe("AdminSubmissionsTable", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("回答者の氏名・メールと選択・自由記述を表示する", async () => {
    mocks.get.mockResolvedValue(makePage([makeSubmission()]))
    render(<AdminSubmissionsTable surveyId="survey-1" />)

    const row = (await screen.findByText("respondent@example.com")).closest(
      "tr"
    ) as HTMLElement
    expect(within(row).getByText("回答 太郎")).toBeInTheDocument()
    expect(within(row).getByText("たろう")).toBeInTheDocument()
    expect(within(row).getByText("はい")).toBeInTheDocument()
    expect(
      within(row).getByText("操作が分かりやすかったです。")
    ).toBeInTheDocument()
    expect(mocks.get).toHaveBeenCalledWith(
      "/api/v1/admin/feedback/submissions",
      {
        params: {
          query: { surveyId: "survey-1", limit: 20, offset: 0 },
        },
      }
    )
  })

  it("次へで offset を進めて再取得する", async () => {
    const user = userEvent.setup()
    mocks.get.mockResolvedValue(makePage([makeSubmission()], 25))
    render(<AdminSubmissionsTable surveyId="survey-1" />)
    await screen.findByText("1–20 / 25 件")

    await user.click(screen.getByRole("button", { name: "次へ" }))

    await waitFor(() => {
      expect(mocks.get).toHaveBeenLastCalledWith(
        "/api/v1/admin/feedback/submissions",
        {
          params: {
            query: { surveyId: "survey-1", limit: 20, offset: 20 },
          },
        }
      )
    })
  })

  it("0 件の空状態を表示する", async () => {
    mocks.get.mockResolvedValue(makePage([]))
    render(<AdminSubmissionsTable surveyId="survey-1" />)

    expect(
      await screen.findByText("このアンケートへの提出はまだありません。")
    ).toBeInTheDocument()
    expect(screen.getByText("0 件")).toBeInTheDocument()
  })

  it("API エラーのレスポンス body を reportError へ渡さない", async () => {
    const apiError = new ApiError(500, {
      email: "private@example.com",
      textValue: "秘密の回答",
    })
    mocks.get.mockRejectedValue(apiError)
    render(<AdminSubmissionsTable surveyId="survey-1" />)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "提出一覧の取得に失敗しました。"
    )
    expect(mocks.reportError).toHaveBeenCalledTimes(1)
    const reported = mocks.reportError.mock.calls[0]?.[0]
    expect(reported).toBeInstanceOf(ApiError)
    expect(reported).not.toBe(apiError)
    expect((reported as ApiError).status).toBe(500)
    expect((reported as ApiError).body).toBeUndefined()
  })
})
