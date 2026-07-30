import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AdminSurveyQuestionEditor } from "./admin-survey-question-editor"

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  reportError: vi.fn(),
}))

vi.mock("@/lib/auth-client", () => ({
  apiBaseUrl: "http://localhost:8080",
  authClient: { useSession: vi.fn() },
}))

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>()
  return {
    ...actual,
    apiClient: { ...actual.apiClient, get: mocks.get, patch: mocks.patch },
  }
})

vi.mock("@/lib/report-error", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/report-error")>()
  return { ...actual, reportError: mocks.reportError }
})

const DRAFT_SURVEY = {
  id: "srv_draft",
  slug: "draft-2026",
  title: "下書きアンケート",
  isActive: false,
  createdAt: "2026-07-01T00:00:00.000Z",
  questions: [
    {
      id: "q_1",
      type: "text" as const,
      text: "感想を教えてください",
      required: false,
      sortOrder: 0,
      choices: [],
    },
  ],
}

describe("AdminSurveyQuestionEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.get.mockResolvedValue(DRAFT_SURVEY)
  })

  it("既存の設問を編集して全置換APIを呼び、親へ更新を通知する", async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    mocks.patch.mockResolvedValue({})
    render(<AdminSurveyQuestionEditor surveyId="srv_draft" onSaved={onSaved} />)

    await user.click(await screen.findByRole("button", { name: "設問を編集" }))
    const question = screen.getByLabelText("本文")
    await user.clear(question)
    await user.type(question, "改善点を教えてください")
    await user.click(screen.getByRole("button", { name: "設問を保存" }))

    await waitFor(() => {
      expect(mocks.patch).toHaveBeenCalledWith(
        "/api/v1/admin/feedback/surveys/{surveyId}/questions",
        {
          params: { path: { surveyId: "srv_draft" } },
          body: {
            questions: [
              {
                type: "text",
                text: "改善点を教えてください",
                required: false,
                choices: [],
              },
            ],
          },
        }
      )
      expect(onSaved).toHaveBeenCalledTimes(1)
    })
  })

  it("公開中のアンケートでは編集ボタンを無効化して理由を表示する", async () => {
    mocks.get.mockResolvedValue({ ...DRAFT_SURVEY, isActive: true })
    render(<AdminSurveyQuestionEditor surveyId="srv_draft" onSaved={vi.fn()} />)

    expect(
      await screen.findByRole("button", { name: "設問を編集" })
    ).toBeDisabled()
    expect(
      screen.getByText(
        "公開中のため編集できません。編集するには一覧画面で無効化してください。"
      )
    ).toBeInTheDocument()
  })
})
