import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AdminPagination } from "./admin-pagination"

describe("AdminPagination", () => {
  it("現在の範囲と総件数を表示する", () => {
    render(
      <AdminPagination
        total={45}
        offset={20}
        limit={20}
        onOffsetChange={vi.fn()}
      />
    )

    expect(screen.getByText("21–40 / 45 件")).toBeInTheDocument()
  })

  it("最終ページでは末尾を総件数に丸める", () => {
    render(
      <AdminPagination
        total={45}
        offset={40}
        limit={20}
        onOffsetChange={vi.fn()}
      />
    )

    expect(screen.getByText("41–45 / 45 件")).toBeInTheDocument()
  })

  it("0 件のときは範囲を出さず「0 件」と表示し、両ボタンが無効", () => {
    render(
      <AdminPagination
        total={0}
        offset={0}
        limit={20}
        onOffsetChange={vi.fn()}
      />
    )

    expect(screen.getByText("0 件")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "前へ" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "次へ" })).toBeDisabled()
  })

  it("先頭ページでは前へが無効、次へで offset + limit を通知する", async () => {
    const user = userEvent.setup()
    const onOffsetChange = vi.fn()
    render(
      <AdminPagination
        total={45}
        offset={0}
        limit={20}
        onOffsetChange={onOffsetChange}
      />
    )

    expect(screen.getByRole("button", { name: "前へ" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "次へ" }))
    expect(onOffsetChange).toHaveBeenCalledWith(20)
  })

  it("最終ページでは次へが無効、前へで offset - limit を通知する", async () => {
    const user = userEvent.setup()
    const onOffsetChange = vi.fn()
    render(
      <AdminPagination
        total={45}
        offset={40}
        limit={20}
        onOffsetChange={onOffsetChange}
      />
    )

    expect(screen.getByRole("button", { name: "次へ" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "前へ" }))
    expect(onOffsetChange).toHaveBeenCalledWith(20)
  })

  it("offset が total を超えていても start が end を超えない", () => {
    render(
      <AdminPagination
        total={5}
        offset={20}
        limit={20}
        onOffsetChange={vi.fn()}
      />
    )

    expect(screen.getByText("5–5 / 5 件")).toBeInTheDocument()
  })

  it("前へで負の offset にならない", async () => {
    const user = userEvent.setup()
    const onOffsetChange = vi.fn()
    render(
      <AdminPagination
        total={45}
        offset={10}
        limit={20}
        onOffsetChange={onOffsetChange}
      />
    )

    await user.click(screen.getByRole("button", { name: "前へ" }))
    expect(onOffsetChange).toHaveBeenCalledWith(0)
  })
})
