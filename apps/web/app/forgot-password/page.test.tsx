import { useEffect } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ForgotPasswordPage from "./page";

const mocks = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}));

// auth-client は import 時に NEXT_PUBLIC_API_URL を要求して throw するため、モジュールごと差し替える
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    emailOtp: {
      requestPasswordReset: mocks.requestPasswordReset,
      resetPassword: mocks.resetPassword,
    },
  },
}));

// Turnstile はブラウザでチャレンジを解いた体で、マウント時に即座に onSuccess を呼ぶ。
vi.mock("@/components/turnstile-widget", () => ({
  TurnstileWidget: ({ onSuccess }: { onSuccess: (token: string) => void }) => {
    useEffect(() => {
      onSuccess("test-captcha-token");
    }, [onSuccess]);
    return null;
  },
}));

async function submitEmail(email = "test@example.com") {
  fireEvent.change(screen.getByLabelText("メールアドレス"), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole("button", { name: "リセットコードを送信" }));
  await waitFor(() => {
    expect(mocks.requestPasswordReset).toHaveBeenCalled();
  });
}

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("メール送信で requestPasswordReset が x-captcha-response ヘッダつきで呼ばれ、コード入力ステップに進む", async () => {
    mocks.requestPasswordReset.mockResolvedValue({ data: { success: true }, error: null });
    render(<ForgotPasswordPage />);

    await submitEmail();

    expect(mocks.requestPasswordReset).toHaveBeenCalledWith(
      { email: "test@example.com" },
      { headers: { "x-captcha-response": "test-captcha-token" } },
    );
    expect(await screen.findByLabelText("リセットコード")).toBeInTheDocument();
  });

  it("送信に失敗したらエラーメッセージを表示する", async () => {
    mocks.requestPasswordReset.mockResolvedValue({
      data: null,
      error: { status: 500, statusText: "Internal Server Error" },
    });
    render(<ForgotPasswordPage />);

    await submitEmail();

    expect(
      await screen.findByText("送信に失敗しました。しばらく経ってから再試行してください。"),
    ).toBeInTheDocument();
  });

  it("コードとパスワードでリセットに成功したら完了画面を表示する", async () => {
    mocks.requestPasswordReset.mockResolvedValue({ data: { success: true }, error: null });
    mocks.resetPassword.mockResolvedValue({ data: { status: true }, error: null });
    render(<ForgotPasswordPage />);

    await submitEmail();
    fireEvent.change(await screen.findByLabelText("リセットコード"), {
      target: { value: "123456" },
    });
    fireEvent.change(screen.getByLabelText("新しいパスワード"), {
      target: { value: "new-password-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "パスワードをリセット" }));

    expect(
      await screen.findByText("パスワードをリセットしました"),
    ).toBeInTheDocument();
    expect(mocks.resetPassword).toHaveBeenCalledWith({
      email: "test@example.com",
      otp: "123456",
      password: "new-password-123",
    });
  });
});
