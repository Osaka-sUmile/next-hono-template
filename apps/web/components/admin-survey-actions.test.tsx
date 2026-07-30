import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AdminSurveyActions } from "./admin-survey-actions"
import { ApiError } from "@/lib/api-client"
import { ExpectedError } from "@/lib/report-error"

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

  it("長いタイトルの複製元でも初期タイトルが API 上限以内に収まる", async () => {
    const user = userEvent.setup()
    const longTitle = "あ".repeat(200)
    render(
      <AdminSurveyActions
        survey={{ ...DRAFT_SURVEY, title: longTitle }}
        onChanged={vi.fn()}
      />
    )

    await user.click(screen.getByRole("button", { name: "複製" }))

    expect(screen.getByLabelText("新しいタイトル")).toHaveValue(
      `${longTitle} のコピー`.slice(0, 200)
    )
  })

  it("複製時にタイトル空文字なら API を呼ばずエラーを表示する", async () => {
    const user = userEvent.setup()
    render(<AdminSurveyActions survey={DRAFT_SURVEY} onChanged={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: "複製" }))
    await user.clear(screen.getByLabelText("新しいタイトル"))
    await user.click(screen.getByRole("button", { name: "複製する" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "タイトルを入力してください。"
    )
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it("複製時に slug 形式が不正なら API を呼ばずエラーを表示する", async () => {
    const user = userEvent.setup()
    render(<AdminSurveyActions survey={DRAFT_SURVEY} onChanged={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: "複製" }))
    await user.clear(screen.getByLabelText("新しい slug"))
    await user.type(screen.getByLabelText("新しい slug"), "Invalid Slug")
    await user.click(screen.getByRole("button", { name: "複製する" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "slug は小文字英数字をハイフンで区切った形式で入力してください。"
    )
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it("複製時の slug 競合は専用メッセージを表示し、想定内として報告する", async () => {
    const user = userEvent.setup()
    const onChanged = vi.fn()
    mocks.post.mockRejectedValue(
      new ApiError(409, {
        error: "slug conflict",
        code: "FEEDBACK_SURVEY_SLUG_CONFLICT",
      })
    )
    render(<AdminSurveyActions survey={DRAFT_SURVEY} onChanged={onChanged} />)

    await user.click(screen.getByRole("button", { name: "複製" }))
    await user.click(screen.getByRole("button", { name: "複製する" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "この slug は既に使われています。別の slug を指定してください。"
    )
    expect(onChanged).not.toHaveBeenCalled()
    expect(mocks.reportError).toHaveBeenCalledWith(expect.any(ExpectedError))
  })

  it("複製時の 400 は専用メッセージを表示する", async () => {
    const user = userEvent.setup()
    mocks.post.mockRejectedValue(new ApiError(400, { error: "bad request" }))
    render(<AdminSurveyActions survey={DRAFT_SURVEY} onChanged={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: "複製" }))
    await user.click(screen.getByRole("button", { name: "複製する" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "入力内容に誤りがあります。"
    )
  })

  it("複製時の 404 は専用メッセージを表示する", async () => {
    const user = userEvent.setup()
    mocks.post.mockRejectedValue(
      new ApiError(404, {
        error: "not found",
        code: "FEEDBACK_SURVEY_NOT_FOUND",
      })
    )
    render(<AdminSurveyActions survey={DRAFT_SURVEY} onChanged={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: "複製" }))
    await user.click(screen.getByRole("button", { name: "複製する" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "複製元のアンケートが見つかりません。"
    )
  })

  it("複製時の想定外エラーは汎用メッセージを表示し、そのまま報告する", async () => {
    const user = userEvent.setup()
    const boom = new Error("boom")
    mocks.post.mockRejectedValue(boom)
    render(<AdminSurveyActions survey={DRAFT_SURVEY} onChanged={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: "複製" }))
    await user.click(screen.getByRole("button", { name: "複製する" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "アンケートの複製に失敗しました。"
    )
    expect(mocks.reportError).toHaveBeenCalledWith(boom)
  })

  it("削除時の FEEDBACK_SURVEY_MUST_BE_INACTIVE は専用メッセージを表示する", async () => {
    const user = userEvent.setup()
    mocks.delete.mockRejectedValue(
      new ApiError(409, {
        error: "must be inactive",
        code: "FEEDBACK_SURVEY_MUST_BE_INACTIVE",
      })
    )
    render(<AdminSurveyActions survey={DRAFT_SURVEY} onChanged={vi.fn()} />)

    await user.click(
      screen.getByRole("button", { name: "PMF アンケート を削除" })
    )
    await user.click(screen.getByRole("button", { name: "完全に削除" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "公開中のアンケートは削除できません。"
    )
  })

  it("削除時の FEEDBACK_SURVEY_HAS_SUBMISSIONS は専用メッセージを表示する", async () => {
    const user = userEvent.setup()
    mocks.delete.mockRejectedValue(
      new ApiError(409, {
        error: "has submissions",
        code: "FEEDBACK_SURVEY_HAS_SUBMISSIONS",
      })
    )
    render(<AdminSurveyActions survey={DRAFT_SURVEY} onChanged={vi.fn()} />)

    await user.click(
      screen.getByRole("button", { name: "PMF アンケート を削除" })
    )
    await user.click(screen.getByRole("button", { name: "完全に削除" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "回答済みのアンケートは削除できません。"
    )
  })

  it("削除時の 404 は一覧を再取得してダイアログを閉じる", async () => {
    const user = userEvent.setup()
    const onChanged = vi.fn()
    mocks.delete.mockRejectedValue(
      new ApiError(404, {
        error: "not found",
        code: "FEEDBACK_SURVEY_NOT_FOUND",
      })
    )
    render(<AdminSurveyActions survey={DRAFT_SURVEY} onChanged={onChanged} />)

    await user.click(
      screen.getByRole("button", { name: "PMF アンケート を削除" })
    )
    await user.click(screen.getByRole("button", { name: "完全に削除" }))

    await waitFor(() => {
      expect(onChanged).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("削除時の想定外エラーは汎用メッセージを表示する", async () => {
    const user = userEvent.setup()
    mocks.delete.mockRejectedValue(new Error("boom"))
    render(<AdminSurveyActions survey={DRAFT_SURVEY} onChanged={vi.fn()} />)

    await user.click(
      screen.getByRole("button", { name: "PMF アンケート を削除" })
    )
    await user.click(screen.getByRole("button", { name: "完全に削除" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "アンケートの削除に失敗しました。"
    )
  })
})
