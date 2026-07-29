import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
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

function ControlledSidebar({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <SidebarProvider
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        setOpen(nextOpen)
      }}
    >
      <Sidebar>Controlled sidebar</Sidebar>
      <SidebarTrigger />
    </SidebarProvider>
  )
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

  it("controlled では親の状態更新を反映して開閉する", () => {
    const onOpenChange = vi.fn()
    const { container } = render(
      <ControlledSidebar onOpenChange={onOpenChange} />
    )
    const trigger = screen.getByRole("button", { name: "Toggle Sidebar" })

    expect(getSidebar(container)).toHaveAttribute("data-state", "collapsed")

    fireEvent.click(trigger)

    expect(getSidebar(container)).toHaveAttribute("data-state", "expanded")

    fireEvent.click(trigger)

    expect(onOpenChange).toHaveBeenNthCalledWith(1, true)
    expect(onOpenChange).toHaveBeenNthCalledWith(2, false)
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

  it("モバイルでは DOM props とマージした className/style を SheetContent に渡す", async () => {
    mocks.isMobile = true
    render(
      <SidebarProvider>
        <Sidebar
          id="mobile-sidebar"
          aria-label="Mobile navigation"
          className="custom-sidebar"
          style={
            {
              "--sidebar-width": "22rem",
              color: "rgb(1, 2, 3)",
            } as React.CSSProperties
          }
        >
          Mobile sidebar props
        </Sidebar>
        <SidebarTrigger />
      </SidebarProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }))

    const content = await screen.findByText("Mobile sidebar props")
    const sidebar = content.closest<HTMLElement>('[data-slot="sidebar"]')

    expect(sidebar).not.toBeNull()
    expect(sidebar).toHaveAttribute("id", "mobile-sidebar")
    expect(sidebar).toHaveAttribute("aria-label", "Mobile navigation")
    expect(sidebar).toHaveClass("custom-sidebar", "bg-sidebar")
    expect(sidebar).toHaveStyle({
      "--sidebar-width": "22rem",
      color: "rgb(1, 2, 3)",
    })
  })

  it("デスクトップでは caller の style を Sidebar container に渡す", () => {
    const { container } = render(
      <SidebarProvider>
        <Sidebar style={{ color: "rgb(4, 5, 6)" }}>Desktop styles</Sidebar>
      </SidebarProvider>
    )

    const sidebarContainer = container.querySelector<HTMLElement>(
      '[data-slot="sidebar-container"]'
    )

    expect(sidebarContainer).not.toBeNull()
    expect(sidebarContainer).toHaveStyle({ color: "rgb(4, 5, 6)" })
  })

  it('collapsible="none" ではモバイルでも常設 Sidebar を描画する', () => {
    mocks.isMobile = true
    const { container } = render(
      <SidebarProvider>
        <Sidebar
          collapsible="none"
          aria-label="Persistent navigation"
          style={{ color: "rgb(7, 8, 9)" }}
        >
          Persistent sidebar
        </Sidebar>
      </SidebarProvider>
    )

    const sidebar = getSidebar(container)
    expect(sidebar).toHaveTextContent("Persistent sidebar")
    expect(sidebar).toHaveAttribute("aria-label", "Persistent navigation")
    expect(sidebar).not.toHaveAttribute("data-state")
    expect(sidebar).not.toHaveAttribute("data-mobile")
    expect(sidebar).toHaveStyle({ color: "rgb(7, 8, 9)" })
  })
})
