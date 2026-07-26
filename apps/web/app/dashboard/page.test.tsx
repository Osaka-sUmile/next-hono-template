import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardPage from "./page";

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
}));

// auth-client は import 時に NEXT_PUBLIC_API_URL を要求して throw するため、モジュールごと差し替える。
// apiBaseUrl は api-client.ts がモジュール読み込み時に openapi-fetch の createClient() へ渡すため必要。
vi.mock("@/lib/auth-client", () => ({
  apiBaseUrl: "http://localhost:8080",
  authClient: { useSession: mocks.useSession },
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("セッションのユーザー情報(表示名/メール/ロール)を表示する", () => {
    mocks.useSession.mockReturnValue({
      data: {
        user: { email: "test@example.com", displayName: "テスト太郎", role: "user" },
        session: {},
      },
      isPending: false,
    });
    render(<DashboardPage />);

    expect(screen.getByText("テスト太郎")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByText("user")).toBeInTheDocument();
  });

  it("displayName が未設定ならプレースホルダを表示する", () => {
    mocks.useSession.mockReturnValue({
      data: {
        user: { email: "admin@example.com", displayName: null, role: "admin" },
        session: {},
      },
      isPending: false,
    });
    render(<DashboardPage />);

    expect(screen.getByText("-")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
  });

  it("セッションが無ければ何も描画しない", () => {
    mocks.useSession.mockReturnValue({ data: null, isPending: false });
    const { container } = render(<DashboardPage />);

    expect(container).toBeEmptyDOMElement();
  });
});
