import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  Sidebar,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"

const mocks = vi.hoisted(() => ({
  isMobile: false,
}))

vi.mock("@workspace/ui/hooks/use-mobile", () => ({
  useIsMobile: () => mocks.isMobile,
}))

function getSidebar(container: HTMLElement) {
  const sidebar = container.querySelector<HTMLElement>('[data-slot="sidebar"]')

  expect(sidebar).not.toBeNull()
  return sidebar!
}

describe("Sidebar", () => {
  beforeEach(() => {
    mocks.isMobile = false
  })

  it("uncontrolled ではトリガー操作でデスクトップの開閉状態を更新する", () => {
    const { container } = render(
      <SidebarProvider defaultOpen={false}>
        <Sidebar>Desktop sidebar</Sidebar>
        <SidebarTrigger />
      </SidebarProvider>
    )

    expect(getSidebar(container)).toHaveAttribute("data-state", "collapsed")
    expect(getSidebar(container)).toHaveAttribute(
      "data-collapsible",
      "offcanvas"
    )

    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }))

    expect(getSidebar(container)).toHaveAttribute("data-state", "expanded")
    expect(getSidebar(container)).toHaveAttribute("data-collapsible", "")
  })

  it("controlled では状態を内部更新せず onOpenChange へ次の状態を通知する", () => {
    const onOpenChange = vi.fn()
    const { container } = render(
      <SidebarProvider open={false} onOpenChange={onOpenChange}>
        <Sidebar>Controlled sidebar</Sidebar>
        <SidebarTrigger />
      </SidebarProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }))

    expect(onOpenChange).toHaveBeenCalledOnce()
    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(getSidebar(container)).toHaveAttribute("data-state", "collapsed")
  })

  it("デスクトップではインラインの Sidebar を描画する", () => {
    const { container } = render(
      <SidebarProvider>
        <Sidebar>Desktop sidebar</Sidebar>
      </SidebarProvider>
    )

    const sidebar = getSidebar(container)
    expect(screen.getByText("Desktop sidebar")).toBeInTheDocument()
    expect(sidebar).toHaveAttribute("data-state", "expanded")
    expect(sidebar).not.toHaveAttribute("data-mobile")
  })

  it("モバイルではトリガー操作で Sheet の Sidebar を開閉する", async () => {
    mocks.isMobile = true
    render(
      <SidebarProvider>
        <Sidebar>Mobile sidebar</Sidebar>
        <SidebarTrigger />
      </SidebarProvider>
    )
    const trigger = screen.getByRole("button", { name: "Toggle Sidebar" })

    expect(screen.queryByText("Mobile sidebar")).not.toBeInTheDocument()

    fireEvent.click(trigger)

    const content = await screen.findByText("Mobile sidebar")
    expect(content.closest('[data-slot="sidebar"]')).toHaveAttribute(
      "data-mobile",
      "true"
    )

    fireEvent.click(trigger)

    await waitFor(() => {
      expect(screen.queryByText("Mobile sidebar")).not.toBeInTheDocument()
    })
  })

  it('collapsible="none" ではモバイルでも常設 Sidebar を描画する', () => {
    mocks.isMobile = true
    const { container } = render(
      <SidebarProvider>
        <Sidebar collapsible="none" aria-label="Persistent navigation">
          Persistent sidebar
        </Sidebar>
      </SidebarProvider>
    )

    const sidebar = getSidebar(container)
    expect(sidebar).toHaveTextContent("Persistent sidebar")
    expect(sidebar).toHaveAttribute("aria-label", "Persistent navigation")
    expect(sidebar).not.toHaveAttribute("data-state")
    expect(sidebar).not.toHaveAttribute("data-mobile")
  })
})
