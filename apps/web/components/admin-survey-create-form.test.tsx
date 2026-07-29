import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AdminSurveyCreateForm } from "./admin-survey-create-form"

const mocks = vi.hoisted(() => ({
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
  return { ...actual, apiClient: { ...actual.apiClient, post: mocks.post } }
})

// reportError は内部で Sentry を叩くため、モックする
vi.mock("@/lib/report-error", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/report-error")>()
  return { ...actual, reportError: mocks.reportError }
})

import { ApiError } from "@/lib/api-client"
import { ExpectedError } from "@/lib/report-error"

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "アンケートを作成" }))
  await screen.findByRole("dialog")
}

describe("AdminSurveyCreateForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("タイトル・slug・設問を入力して送信すると POST を呼び、onCreated を呼ぶ", async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    mocks.post.mockResolvedValue({
      id: "srv_new",
      slug: "pmf-2027",
      title: "新しいアンケート",
      isActive: false,
      questions: [],
    })
    render(<AdminSurveyCreateForm onCreated={onCreated} />)

    await openDialog(user)
    // userEvent.type は 1 文字ずつ入力して遅く、CI の並列実行下でタイムアウト
    // しやすいため、入力文字列は短く保つ。
    await user.type(screen.getByLabelText("タイトル"), "新アンケート")
    await user.type(screen.getByLabelText("slug"), "pmf-2027")

    // 設問(単一選択がデフォルト、空の選択肢 1 行つき)を追加して埋める
    await user.click(screen.getByRole("button", { name: "設問を追加" }))
    await user.type(screen.getByLabelText("本文"), "満足度は?")
    await user.type(screen.getByLabelText("値"), "good")
    await user.type(screen.getByLabelText("ラベル"), "満足")

    await user.click(screen.getByRole("button", { name: "作成" }))

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(1)
    })
    expect(mocks.post).toHaveBeenCalledWith("/api/v1/admin/feedback/surveys", {
      body: {
        slug: "pmf-2027",
        title: "新アンケート",
        isActive: false,
        questions: [
          {
            type: "single_choice",
            text: "満足度は?",
            required: false,
            choices: [{ value: "good", label: "満足" }],
          },
        ],
      },
    })
    // 成功時はダイアログが閉じる
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })

  it("設問なしでも作成できる(あとから追加不可の注記が出る)", async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    mocks.post.mockResolvedValue({})
    render(<AdminSurveyCreateForm onCreated={onCreated} />)

    await openDialog(user)
    await user.type(screen.getByLabelText("タイトル"), "下書きアンケート")
    await user.type(screen.getByLabelText("slug"), "draft-2027")
    await user.click(screen.getByRole("button", { name: "作成" }))

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith(
        "/api/v1/admin/feedback/surveys",
        {
          body: {
            slug: "draft-2027",
            title: "下書きアンケート",
            isActive: false,
            questions: [],
          },
        }
      )
    })
  })

  it("slug が不正な形式なら POST せずにエラーを表示する", async () => {
    const user = userEvent.setup()
    render(<AdminSurveyCreateForm onCreated={vi.fn()} />)

    await openDialog(user)
    await user.type(screen.getByLabelText("タイトル"), "テスト")
    await user.type(screen.getByLabelText("slug"), "Invalid Slug!")
    await user.click(screen.getByRole("button", { name: "作成" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "slug は小文字英数字をハイフンで区切った形式で入力してください"
    )
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it("設問 0 件で有効化しようとすると POST せずにエラーを表示する", async () => {
    const user = userEvent.setup()
    render(<AdminSurveyCreateForm onCreated={vi.fn()} />)

    await openDialog(user)
    await user.type(screen.getByLabelText("タイトル"), "テスト")
    await user.type(screen.getByLabelText("slug"), "test-2027")
    await user.click(screen.getByLabelText("作成と同時に有効化する"))
    await user.click(screen.getByRole("button", { name: "作成" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "設問が 1 問もないアンケートは有効化できません。"
    )
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it("単一選択の設問で選択肢が空なら POST せずにエラーを表示する", async () => {
    const user = userEvent.setup()
    render(<AdminSurveyCreateForm onCreated={vi.fn()} />)

    await openDialog(user)
    await user.type(screen.getByLabelText("タイトル"), "テスト")
    await user.type(screen.getByLabelText("slug"), "test-2027")
    await user.click(screen.getByRole("button", { name: "設問を追加" }))
    await user.type(screen.getByLabelText("本文"), "設問本文")
    // デフォルトで付いてくる空の選択肢行をそのままにする
    await user.click(screen.getByRole("button", { name: "作成" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "設問 1 の選択肢 1 の値とラベルを入力してください。"
    )
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it("自由記述に切り替えると選択肢 UI が消え、choices は空で送られる", async () => {
    const user = userEvent.setup()
    mocks.post.mockResolvedValue({})
    render(<AdminSurveyCreateForm onCreated={vi.fn()} />)

    await openDialog(user)
    await user.type(screen.getByLabelText("タイトル"), "テスト")
    await user.type(screen.getByLabelText("slug"), "test-2027")
    await user.click(screen.getByRole("button", { name: "設問を追加" }))
    await user.type(screen.getByLabelText("本文"), "感想は?")

    await user.click(screen.getByLabelText("種別"))
    await user.click(await screen.findByRole("option", { name: "自由記述" }))
    expect(screen.queryByText("選択肢")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "作成" }))

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith(
        "/api/v1/admin/feedback/surveys",
        {
          body: expect.objectContaining({
            questions: [
              {
                type: "text",
                text: "感想は?",
                required: false,
                choices: [],
              },
            ],
          }),
        }
      )
    })
  })

  it("409 FEEDBACK_SURVEY_SLUG_CONFLICT は slug 重複メッセージに変換し、想定内として報告する", async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    mocks.post.mockRejectedValue(
      new ApiError(409, {
        error: "slug conflict",
        code: "FEEDBACK_SURVEY_SLUG_CONFLICT",
      })
    )
    render(<AdminSurveyCreateForm onCreated={onCreated} />)

    await openDialog(user)
    await user.type(screen.getByLabelText("タイトル"), "テスト")
    await user.type(screen.getByLabelText("slug"), "pmf-2026")
    await user.click(screen.getByRole("button", { name: "作成" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "この slug は既に使われています。"
    )
    expect(onCreated).not.toHaveBeenCalled()
    expect(mocks.reportError).toHaveBeenCalledWith(expect.any(ExpectedError))
    // ダイアログは開いたまま(入力を直して再送信できる)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("想定外のエラーは汎用メッセージを表示し、そのまま報告する", async () => {
    const user = userEvent.setup()
    const boom = new Error("boom")
    mocks.post.mockRejectedValue(boom)
    render(<AdminSurveyCreateForm onCreated={vi.fn()} />)

    await openDialog(user)
    await user.type(screen.getByLabelText("タイトル"), "テスト")
    await user.type(screen.getByLabelText("slug"), "test-2027")
    await user.click(screen.getByRole("button", { name: "作成" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "アンケートの作成に失敗しました。"
    )
    expect(mocks.reportError).toHaveBeenCalledWith(boom)
  })

  it("送信中はダイアログを閉じられず、完了後に正しく閉じる", async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    let resolvePost!: (value: unknown) => void
    const postPromise = new Promise((resolve) => {
      resolvePost = resolve
    })
    mocks.post.mockReturnValue(postPromise)
    render(<AdminSurveyCreateForm onCreated={onCreated} />)

    await openDialog(user)
    await user.type(screen.getByLabelText("タイトル"), "進行中")
    await user.type(screen.getByLabelText("slug"), "pending-2027")
    await user.click(screen.getByRole("button", { name: "作成" }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "作成中..." })).toBeDisabled()
    })
    expect(screen.getByRole("button", { name: "キャンセル" })).toBeDisabled()
    expect(screen.getByLabelText("タイトル")).toBeDisabled()
    expect(screen.getByLabelText("slug")).toBeDisabled()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByLabelText("タイトル")).toHaveValue("進行中")

    resolvePost({})
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })

  it("設問と選択肢の削除ボタンで行を取り除ける", async () => {
    const user = userEvent.setup()
    render(<AdminSurveyCreateForm onCreated={vi.fn()} />)

    await openDialog(user)
    await user.click(screen.getByRole("button", { name: "設問を追加" }))
    await user.click(screen.getByRole("button", { name: "選択肢を追加" }))
    expect(screen.getAllByLabelText("値")).toHaveLength(2)

    await user.click(
      screen.getByRole("button", { name: "設問 1 の選択肢 2 を削除" })
    )
    expect(screen.getAllByLabelText("値")).toHaveLength(1)

    await user.click(screen.getByRole("button", { name: "設問 1 を削除" }))
    expect(screen.queryByLabelText("本文")).not.toBeInTheDocument()
  })
})
