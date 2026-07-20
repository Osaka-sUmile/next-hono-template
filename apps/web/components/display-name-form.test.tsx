import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as Sentry from "@sentry/nextjs";
import { DisplayNameForm } from "./display-name-form";

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  apiBaseUrl: "http://localhost:8080",
  authClient: {
    useSession: () => ({ refetch: mocks.refetch }),
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

describe("DisplayNameForm", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = fetchMock;
  });

  it("保存成功時に PATCH を呼び refetch して成功メッセージを表示する", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    render(<DisplayNameForm initialDisplayName="" />);

    fireEvent.change(screen.getByLabelText("表示名"), { target: { value: "太郎" } });
    fireEvent.click(screen.getByRole("button", { name: "表示名を保存" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("http://localhost:8080/api/v1/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "太郎" }),
      });
    });
    expect(mocks.refetch).toHaveBeenCalled();
    expect(await screen.findByText("保存しました。")).toBeInTheDocument();
  });

  it("空入力を保存すると displayName を null で送る", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    render(<DisplayNameForm initialDisplayName="既存" />);

    fireEvent.change(screen.getByLabelText("表示名"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "表示名を保存" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8080/api/v1/me",
        expect.objectContaining({
          body: JSON.stringify({ displayName: null }),
        }),
      );
    });
  });

  it("500 応答時はエラーメッセージを表示し refetch しない", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    render(<DisplayNameForm initialDisplayName="既存" />);

    fireEvent.click(screen.getByRole("button", { name: "表示名を保存" }));

    expect(
      await screen.findByText("表示名の更新に失敗しました。ログイン済みか確認してください。"),
    ).toBeInTheDocument();
    expect(mocks.refetch).not.toHaveBeenCalled();
  });

  it("401 応答時はエラーメッセージを表示し refetch せず Sentry に送らない", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    render(<DisplayNameForm initialDisplayName="既存" />);

    fireEvent.click(screen.getByRole("button", { name: "表示名を保存" }));

    expect(
      await screen.findByText("表示名の更新に失敗しました。ログイン済みか確認してください。"),
    ).toBeInTheDocument();
    expect(mocks.refetch).not.toHaveBeenCalled();
    expect(vi.mocked(Sentry.captureException)).not.toHaveBeenCalled();
  });

  it("refetch 失敗時も保存成功メッセージを表示し refetch エラーを Sentry に送る", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    mocks.refetch.mockRejectedValueOnce(new Error("refetch failed"));
    render(<DisplayNameForm initialDisplayName="既存" />);

    fireEvent.change(screen.getByLabelText("表示名"), { target: { value: "新しい名前" } });
    fireEvent.click(screen.getByRole("button", { name: "表示名を保存" }));

    expect(await screen.findByText("保存しました。")).toBeInTheDocument();
    expect(mocks.refetch).toHaveBeenCalled();
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalled();
    expect(vi.mocked(Sentry.captureException).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ message: "refetch failed" }),
    );
  });
});
