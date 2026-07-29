import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ApiError } from "@/lib/api-client"
import { AdminUserRoleSelect } from "./admin-user-role-select"

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

function renderSelect(
  overrides: Partial<React.ComponentProps<typeof AdminUserRoleSelect>> = {}
) {
  const onChanged = vi.fn()
  render(
    <AdminUserRoleSelect
      userId="user_2"
      role="user"
      userEmail="member@example.com"
      onChanged={onChanged}
      {...overrides}
    />
  )
  return { onChanged }
}

describe("AdminUserRoleSelect", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("現在のロールを表示する", () => {
    renderSelect()

    expect(
      screen.getByRole("combobox", { name: "member@example.com のロール" })
    ).toHaveTextContent("一般")
  })

  it("ロール変更で PATCH を呼び、成功したら onChanged を呼ぶ", async () => {
    const user = userEvent.setup()
    mocks.patch.mockResolvedValue({})
    const { onChanged } = renderSelect()

    await user.click(screen.getByRole("combobox"))
    await user.click(screen.getByRole("option", { name: "管理者" }))

    await waitFor(() => {
      expect(mocks.patch).toHaveBeenCalledWith(
        "/api/v1/admin/users/{userId}/role",
        {
          params: { path: { userId: "user_2" } },
          body: { role: "admin" },
        }
      )
    })
    await waitFor(() => {
      expect(onChanged).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("同じロールを選び直しても PATCH を呼ばない", async () => {
    const user = userEvent.setup()
    renderSelect()

    await user.click(screen.getByRole("combobox"))
    await user.click(screen.getByRole("option", { name: "一般" }))

    expect(mocks.patch).not.toHaveBeenCalled()
  })

  it("disabled のときは操作できない", () => {
    renderSelect({ disabled: true })

    expect(screen.getByRole("combobox")).toBeDisabled()
  })

  it("失敗したらエラーをインライン表示し、reportError を呼び、onChanged は呼ばない", async () => {
    const user = userEvent.setup()
    const error = new ApiError(500, {
      error: "Internal Server Error",
      code: "INTERNAL_ERROR",
    })
    mocks.patch.mockRejectedValue(error)
    const { onChanged } = renderSelect()

    await user.click(screen.getByRole("combobox"))
    await user.click(screen.getByRole("option", { name: "管理者" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ロールの変更に失敗しました。"
    )
    expect(mocks.reportError).toHaveBeenCalledWith(error)
    expect(onChanged).not.toHaveBeenCalled()
  })

  it("CANNOT_CHANGE_OWN_ROLE は専用メッセージに変換する", async () => {
    const user = userEvent.setup()
    mocks.patch.mockRejectedValue(
      new ApiError(403, {
        error: "Cannot change own role",
        code: "CANNOT_CHANGE_OWN_ROLE",
      })
    )
    renderSelect()

    await user.click(screen.getByRole("combobox"))
    await user.click(screen.getByRole("option", { name: "管理者" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "自分自身のロールは変更できません。"
    )
  })

  it("404 は「ユーザーが見つからない」メッセージに変換する", async () => {
    const user = userEvent.setup()
    mocks.patch.mockRejectedValue(
      new ApiError(404, { error: "User not found", code: "USER_NOT_FOUND" })
    )
    renderSelect()

    await user.click(screen.getByRole("combobox"))
    await user.click(screen.getByRole("option", { name: "管理者" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "対象のユーザーが見つかりませんでした。"
    )
  })
})
