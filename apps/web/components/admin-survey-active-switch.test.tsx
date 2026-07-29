import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AdminSurveyActiveSwitch } from "./admin-survey-active-switch"

const mocks = vi.hoisted(() => ({
  patch: vi.fn(),
  reportError: vi.fn(),
}))

// auth-client は import 時に NEXT_PUBLIC_API_URL を要求して throw するため、モジュールごと差し替える
vi.mock("@/lib/auth-client", () => ({
  apiBaseUrl: "http://localhost:8080",
  authClient: { useSession: vi.fn() },
}))

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>()
  return { ...actual, apiClient: { ...actual.apiClient, patch: mocks.patch } }
})

// reportError は内部で Sentry を叩くため、モックする
vi.mock("@/lib/report-error", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/report-error")>()
  return { ...actual, reportError: mocks.reportError }
})

import { ApiError } from "@/lib/api-client"
import { ExpectedError } from "@/lib/report-error"

describe("AdminSurveyActiveSwitch", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("トグルで PATCH を呼び、成功したら onChanged を呼ぶ", async () => {
    const user = userEvent.setup()
    const onChanged = vi.fn()
    mocks.patch.mockResolvedValue({
      id: "srv_1",
      slug: "pmf-2026",
      title: "PMF アンケート",
      isActive: true,
      questions: [],
    })
    render(
      <AdminSurveyActiveSwitch
        surveyId="srv_1"
        title="PMF アンケート"
        isActive={false}
        onChanged={onChanged}
      />
    )

    await user.click(
      screen.getByRole("switch", { name: "PMF アンケート を有効化" })
    )

    await waitFor(() => {
      expect(onChanged).toHaveBeenCalledTimes(1)
    })
    expect(mocks.patch).toHaveBeenCalledWith(
      "/api/v1/admin/feedback/surveys/{surveyId}",
      {
        params: { path: { surveyId: "srv_1" } },
        body: { isActive: true },
      }
    )
  })

  it("有効なアンケートのトグルは isActive: false を送る", async () => {
    const user = userEvent.setup()
    mocks.patch.mockResolvedValue({})
    render(
      <AdminSurveyActiveSwitch
        surveyId="srv_1"
        title="PMF アンケート"
        isActive={true}
        onChanged={vi.fn()}
      />
    )

    await user.click(
      screen.getByRole("switch", { name: "PMF アンケート を無効化" })
    )

    await waitFor(() => {
      expect(mocks.patch).toHaveBeenCalledWith(
        "/api/v1/admin/feedback/surveys/{surveyId}",
        expect.objectContaining({ body: { isActive: false } })
      )
    })
  })

  it("409 FEEDBACK_SURVEY_NOT_PUBLISHABLE は読めるメッセージに変換し、想定内として報告する", async () => {
    const user = userEvent.setup()
    const onChanged = vi.fn()
    mocks.patch.mockRejectedValue(
      new ApiError(409, {
        error: "not publishable",
        code: "FEEDBACK_SURVEY_NOT_PUBLISHABLE",
      })
    )
    render(
      <AdminSurveyActiveSwitch
        surveyId="srv_1"
        title="空アンケート"
        isActive={false}
        onChanged={onChanged}
      />
    )

    await user.click(screen.getByRole("switch"))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "設問が 1 問もないアンケートは有効化できません。"
    )
    expect(onChanged).not.toHaveBeenCalled()
    expect(mocks.reportError).toHaveBeenCalledWith(expect.any(ExpectedError))
  })

  it("想定外のエラーは汎用メッセージを表示し、そのまま報告する", async () => {
    const user = userEvent.setup()
    const boom = new Error("boom")
    mocks.patch.mockRejectedValue(boom)
    render(
      <AdminSurveyActiveSwitch
        surveyId="srv_1"
        title="PMF アンケート"
        isActive={false}
        onChanged={vi.fn()}
      />
    )

    await user.click(screen.getByRole("switch"))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "有効状態の更新に失敗しました。"
    )
    expect(mocks.reportError).toHaveBeenCalledWith(boom)
  })
})
