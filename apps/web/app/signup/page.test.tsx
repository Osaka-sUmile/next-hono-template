import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SignupPage from "./page";

const mocks = vi.hoisted(() => ({
  sendVerificationOtp: vi.fn(),
  signInEmailOtp: vi.fn(),
  signInSocial: vi.fn(),
  replace: vi.fn(),
}));

// auth-client は import 時に NEXT_PUBLIC_API_URL を要求して throw するため、モジュールごと差し替える
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    emailOtp: { sendVerificationOtp: mocks.sendVerificationOtp },
    signIn: { emailOtp: mocks.signInEmailOtp, social: mocks.signInSocial },
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, push: vi.fn() }),
}));

async function submitEmail({ email = "test@example.com", displayName = "" } = {}) {
  fireEvent.change(screen.getByLabelText("メールアドレス"), {
    target: { value: email },
  });
  if (displayName) {
    fireEvent.change(screen.getByLabelText("表示名（任意）"), {
      target: { value: displayName },
    });
  }
  fireEvent.click(screen.getByRole("button", { name: "認証コードを送信" }));
  await waitFor(() => {
    expect(mocks.sendVerificationOtp).toHaveBeenCalled();
  });
}

async function submitOtp(otp = "123456") {
  fireEvent.change(await screen.findByLabelText("認証コード"), {
    target: { value: otp },
  });
  fireEvent.click(screen.getByRole("button", { name: "登録する" }));
  await waitFor(() => {
    expect(mocks.signInEmailOtp).toHaveBeenCalled();
  });
}

describe("SignupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("メール送信で sendVerificationOtp が呼ばれ、コード入力ステップに進む", async () => {
    mocks.sendVerificationOtp.mockResolvedValue({ data: { success: true }, error: null });
    render(<SignupPage />);

    await submitEmail();

    expect(mocks.sendVerificationOtp).toHaveBeenCalledWith(
      { email: "test@example.com", type: "sign-in" },
      { headers: { "x-signup-intent": "1" } },
    );
    expect(await screen.findByLabelText("認証コード")).toBeInTheDocument();
  });

  it("コード送信に失敗したらエラーメッセージを表示する", async () => {
    mocks.sendVerificationOtp.mockResolvedValue({
      data: null,
      error: { status: 500, statusText: "Internal Server Error" },
    });
    render(<SignupPage />);

    await submitEmail();

    expect(
      await screen.findByText("送信に失敗しました。しばらく経ってから再試行してください。"),
    ).toBeInTheDocument();
  });

  it("表示名ありなら signIn.emailOtp に displayName を渡してリダイレクトする", async () => {
    mocks.sendVerificationOtp.mockResolvedValue({ data: { success: true }, error: null });
    mocks.signInEmailOtp.mockResolvedValue({ data: { token: "tok" }, error: null });
    render(<SignupPage />);

    await submitEmail({ displayName: "テスト太郎" });
    await submitOtp();

    expect(mocks.signInEmailOtp).toHaveBeenCalledWith({
      email: "test@example.com",
      otp: "123456",
      signUp: true,
      displayName: "テスト太郎",
    });
    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("表示名が空なら signIn.emailOtp に displayName を渡さない", async () => {
    mocks.sendVerificationOtp.mockResolvedValue({ data: { success: true }, error: null });
    mocks.signInEmailOtp.mockResolvedValue({ data: { token: "tok" }, error: null });
    render(<SignupPage />);

    await submitEmail();
    await submitOtp();

    expect(mocks.signInEmailOtp).toHaveBeenCalledWith({
      email: "test@example.com",
      otp: "123456",
      signUp: true,
    });
    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("OTP が不正ならエラーメッセージを表示し、リダイレクトしない", async () => {
    mocks.sendVerificationOtp.mockResolvedValue({ data: { success: true }, error: null });
    mocks.signInEmailOtp.mockResolvedValue({
      data: null,
      error: { code: "INVALID_OTP", message: "invalid otp", status: 400, statusText: "Bad Request" },
    });
    render(<SignupPage />);

    await submitEmail();
    await submitOtp("000000");

    expect(
      await screen.findByText("コードが正しくありません。または有効期限が切れています。"),
    ).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("Google ボタンで signIn.social が web オリジンの絶対 URL つきで呼ばれる", async () => {
    mocks.signInSocial.mockResolvedValue({ data: { url: "https://example.com", redirect: true }, error: null });
    render(<SignupPage />);

    fireEvent.click(screen.getByRole("button", { name: "Google で登録" }));

    await waitFor(() => {
      expect(mocks.signInSocial).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: `${window.location.origin}/dashboard`,
        errorCallbackURL: `${window.location.origin}/signup`,
        // 新規登録意図を明示。これがないと disableImplicitSignUp により登録が拒否される
        requestSignUp: true,
      });
    });
  });
});
