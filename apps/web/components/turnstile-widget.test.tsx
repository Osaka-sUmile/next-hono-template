import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render } from "@testing-library/react"

const mocks = vi.hoisted(() => ({
  useTheme: vi.fn(),
  Turnstile: vi.fn(() => null),
}))

vi.mock("next-themes", () => ({
  useTheme: mocks.useTheme,
}))

vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: mocks.Turnstile,
}))

// siteKey は import 時に検証されるため、モジュールごとにリセットして都度 import し直す。
async function loadWidget() {
  vi.resetModules()
  const mod = await import("./turnstile-widget")
  return mod.TurnstileWidget
}

describe("TurnstileWidget", () => {
  beforeEach(() => {
    mocks.Turnstile.mockClear()
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "test-site-key")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("siteKey を NEXT_PUBLIC_TURNSTILE_SITE_KEY から渡す", async () => {
    mocks.useTheme.mockReturnValue({ resolvedTheme: "light" })
    const TurnstileWidget = await loadWidget()
    render(<TurnstileWidget onSuccess={vi.fn()} />)

    expect(mocks.Turnstile).toHaveBeenCalledWith(
      expect.objectContaining({ siteKey: "test-site-key" }),
      undefined
    )
  })

  it("resolvedTheme が dark なら options.theme に dark を渡す", async () => {
    mocks.useTheme.mockReturnValue({ resolvedTheme: "dark" })
    const TurnstileWidget = await loadWidget()
    render(<TurnstileWidget onSuccess={vi.fn()} />)

    expect(mocks.Turnstile).toHaveBeenCalledWith(
      expect.objectContaining({ options: { theme: "dark" } }),
      undefined
    )
  })

  it("resolvedTheme が dark 以外(light・未解決)なら options.theme に light を渡す", async () => {
    mocks.useTheme.mockReturnValue({ resolvedTheme: undefined })
    const TurnstileWidget = await loadWidget()
    render(<TurnstileWidget onSuccess={vi.fn()} />)

    expect(mocks.Turnstile).toHaveBeenCalledWith(
      expect.objectContaining({ options: { theme: "light" } }),
      undefined
    )
  })

  it("onSuccess / onExpire をそのまま Turnstile に委譲する", async () => {
    mocks.useTheme.mockReturnValue({ resolvedTheme: "light" })
    const onSuccess = vi.fn()
    const onExpire = vi.fn()
    const TurnstileWidget = await loadWidget()
    render(<TurnstileWidget onSuccess={onSuccess} onExpire={onExpire} />)

    expect(mocks.Turnstile).toHaveBeenCalledWith(
      expect.objectContaining({ onSuccess, onExpire }),
      undefined
    )
  })

  it("NEXT_PUBLIC_TURNSTILE_SITE_KEY が未設定だと import 時に throw する", async () => {
    vi.unstubAllEnvs()
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "")
    vi.resetModules()

    await expect(import("./turnstile-widget")).rejects.toThrow(
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY is required"
    )
  })
})
