import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AdminSurveyQuestionEditor } from "./admin-survey-question-editor"
import { ApiError } from "@/lib/api-client"
import { ExpectedError } from "@/lib/report-error"

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

  it("本文が空のまま保存すると PATCH を呼ばず検証エラーを表示する", async () => {
    const user = userEvent.setup()
    render(<AdminSurveyQuestionEditor surveyId="srv_draft" onSaved={vi.fn()} />)

    await user.click(await screen.findByRole("button", { name: "設問を編集" }))
    await user.clear(screen.getByLabelText("本文"))
    await user.click(screen.getByRole("button", { name: "設問を保存" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "設問 1 の本文を入力してください。"
    )
    expect(mocks.patch).not.toHaveBeenCalled()
  })

  it("PATCH が FEEDBACK_SURVEY_MUST_BE_INACTIVE を返したら専用メッセージを表示する", async () => {
    const user = userEvent.setup()
    mocks.patch.mockRejectedValue(
      new ApiError(409, {
        error: "must be inactive",
        code: "FEEDBACK_SURVEY_MUST_BE_INACTIVE",
      })
    )
    render(<AdminSurveyQuestionEditor surveyId="srv_draft" onSaved={vi.fn()} />)

    await user.click(await screen.findByRole("button", { name: "設問を編集" }))
    await user.click(screen.getByRole("button", { name: "設問を保存" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "公開中のアンケートは編集できません。先に一覧画面で無効化してください。"
    )
    expect(mocks.reportError).toHaveBeenCalledWith(expect.any(ExpectedError))
  })

  it("PATCH が FEEDBACK_SURVEY_HAS_SUBMISSIONS を返したら専用メッセージを表示する", async () => {
    const user = userEvent.setup()
    mocks.patch.mockRejectedValue(
      new ApiError(409, {
        error: "has submissions",
        code: "FEEDBACK_SURVEY_HAS_SUBMISSIONS",
      })
    )
    render(<AdminSurveyQuestionEditor surveyId="srv_draft" onSaved={vi.fn()} />)

    await user.click(await screen.findByRole("button", { name: "設問を編集" }))
    await user.click(screen.getByRole("button", { name: "設問を保存" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "回答済みのアンケートは編集できません。複製して新しい下書きを作成してください。"
    )
    expect(mocks.reportError).toHaveBeenCalledWith(expect.any(ExpectedError))
  })

  it("PATCH の 400 は専用メッセージを表示する", async () => {
    const user = userEvent.setup()
    mocks.patch.mockRejectedValue(new ApiError(400, { error: "bad request" }))
    render(<AdminSurveyQuestionEditor surveyId="srv_draft" onSaved={vi.fn()} />)

    await user.click(await screen.findByRole("button", { name: "設問を編集" }))
    await user.click(screen.getByRole("button", { name: "設問を保存" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "入力内容に誤りがあります。各設問を確認してください。"
    )
  })

  it("PATCH の 404 は専用メッセージを表示する", async () => {
    const user = userEvent.setup()
    mocks.patch.mockRejectedValue(
      new ApiError(404, {
        error: "not found",
        code: "FEEDBACK_SURVEY_NOT_FOUND",
      })
    )
    render(<AdminSurveyQuestionEditor surveyId="srv_draft" onSaved={vi.fn()} />)

    await user.click(await screen.findByRole("button", { name: "設問を編集" }))
    await user.click(screen.getByRole("button", { name: "設問を保存" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "アンケートが見つかりません。"
    )
  })
})
