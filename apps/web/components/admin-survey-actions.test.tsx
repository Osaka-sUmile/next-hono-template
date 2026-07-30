import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AdminSurveyActions } from "./admin-survey-actions"

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  delete: vi.fn(),
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
    apiClient: { ...actual.apiClient, post: mocks.post, delete: mocks.delete },
  }
})

vi.mock("@/lib/report-error", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/report-error")>()
  return { ...actual, reportError: mocks.reportError }
})

const DRAFT_SURVEY = {
  id: "srv_draft",
  slug: "pmf-2026",
  title: "PMF アンケート",
  isActive: false,
  submissionCount: 0,
}

describe("AdminSurveyActions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("複製先のタイトル・slug を指定して複製し、一覧を再取得する", async () => {
    const user = userEvent.setup()
    const onChanged = vi.fn()
    mocks.post.mockResolvedValue({})
    render(<AdminSurveyActions survey={DRAFT_SURVEY} onChanged={onChanged} />)

    await user.click(screen.getByRole("button", { name: "複製" }))
    expect(screen.getByLabelText("新しいタイトル")).toHaveValue(
      "PMF アンケート のコピー"
    )
    expect(screen.getByLabelText("新しい slug")).toHaveValue("pmf-2026-copy")
    await user.clear(screen.getByLabelText("新しい slug"))
    await user.type(screen.getByLabelText("新しい slug"), "pmf-2027")
    await user.click(screen.getByRole("button", { name: "複製する" }))

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith(
        "/api/v1/admin/feedback/surveys/{surveyId}/duplicate",
        {
          params: { path: { surveyId: "srv_draft" } },
          body: { title: "PMF アンケート のコピー", slug: "pmf-2027" },
        }
      )
      expect(onChanged).toHaveBeenCalledTimes(1)
    })
  })

  it("未回答の下書きを確認後に削除し、一覧を再取得する", async () => {
    const user = userEvent.setup()
    const onChanged = vi.fn()
    mocks.delete.mockResolvedValue(undefined)
    render(<AdminSurveyActions survey={DRAFT_SURVEY} onChanged={onChanged} />)

    await user.click(
      screen.getByRole("button", { name: "PMF アンケート を削除" })
    )
    await user.click(screen.getByRole("button", { name: "完全に削除" }))

    await waitFor(() => {
      expect(mocks.delete).toHaveBeenCalledWith(
        "/api/v1/admin/feedback/surveys/{surveyId}",
        { params: { path: { surveyId: "srv_draft" } } }
      )
      expect(onChanged).toHaveBeenCalledTimes(1)
    })
  })

  it("公開中または回答済みのアンケートでは削除操作を無効化する", () => {
    const { rerender } = render(
      <AdminSurveyActions
        survey={{ ...DRAFT_SURVEY, isActive: true }}
        onChanged={vi.fn()}
      />
    )
    expect(
      screen.getByRole("button", { name: "PMF アンケート を削除" })
    ).toBeDisabled()

    rerender(
      <AdminSurveyActions
        survey={{ ...DRAFT_SURVEY, submissionCount: 1 }}
        onChanged={vi.fn()}
      />
    )
    expect(
      screen.getByRole("button", { name: "PMF アンケート を削除" })
    ).toBeDisabled()
  })
})
