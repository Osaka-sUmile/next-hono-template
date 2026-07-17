import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "./page";

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
  // window.location.search と連動させ、テストごとに history.replaceState で設定した
  // ?error= をそのまま反映する(実装は useSearchParams で ?error= を読むため)
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

async function submitEmail(email = "test@example.com") {
  fireEvent.change(screen.getByLabelText("メールアドレス"), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole("button", { name: "認証コードを送信" }));
  await waitFor(() => {
    expect(mocks.sendVerificationOtp).toHaveBeenCalled();
  });
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // social ログインのエラークエリを読むため、各テスト前に URL を初期化する
    window.history.replaceState({}, "", "/login");
  });

  it("メール送信で sendVerificationOtp が呼ばれ、コード入力ステップに進む", async () => {
    mocks.sendVerificationOtp.mockResolvedValue({ data: { success: true }, error: null });
    render(<LoginPage />);

    await submitEmail();

    expect(mocks.sendVerificationOtp).toHaveBeenCalledWith({
      email: "test@example.com",
      type: "sign-in",
    });
    expect(await screen.findByLabelText("認証コード")).toBeInTheDocument();
  });

  it("コード送信に失敗したらエラーメッセージを表示する", async () => {
    mocks.sendVerificationOtp.mockResolvedValue({
      data: null,
      error: { status: 500, statusText: "Internal Server Error" },
    });
    render(<LoginPage />);

    await submitEmail();

    expect(
      await screen.findByText("送信に失敗しました。しばらく経ってから再試行してください。"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("認証コード")).not.toBeInTheDocument();
  });

  it("OTP 検証に成功したらトップへリダイレクトする", async () => {
    mocks.sendVerificationOtp.mockResolvedValue({ data: { success: true }, error: null });
    mocks.signInEmailOtp.mockResolvedValue({ data: { token: "tok" }, error: null });
    render(<LoginPage />);

    await submitEmail();
    fireEvent.change(await screen.findByLabelText("認証コード"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => {
      expect(mocks.signInEmailOtp).toHaveBeenCalledWith({
        email: "test@example.com",
        otp: "123456",
      });
      expect(mocks.replace).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("OTP が不正ならエラーメッセージを表示し、リダイレクトしない", async () => {
    mocks.sendVerificationOtp.mockResolvedValue({ data: { success: true }, error: null });
    mocks.signInEmailOtp.mockResolvedValue({
      data: null,
      error: { code: "INVALID_OTP", message: "invalid otp", status: 400, statusText: "Bad Request" },
    });
    render(<LoginPage />);

    await submitEmail();
    fireEvent.change(await screen.findByLabelText("認証コード"), {
      target: { value: "000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    expect(
      await screen.findByText("コードが正しくありません。または有効期限が切れています。"),
    ).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("Google ボタンで signIn.social が web オリジンの絶対 URL つきで呼ばれる", async () => {
    mocks.signInSocial.mockResolvedValue({ data: { url: "https://example.com", redirect: true }, error: null });
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Google でログイン" }));

    await waitFor(() => {
      expect(mocks.signInSocial).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: `${window.location.origin}/dashboard`,
        errorCallbackURL: `${window.location.origin}/login`,
      });
    });
    // ログインからの social は新規登録意図を渡さない(未登録は自動作成させない)
    expect(mocks.signInSocial.mock.calls[0]?.[0]).not.toHaveProperty("requestSignUp");
  });

  it("Apple ボタンで signIn.social が provider: apple で呼ばれる", async () => {
    mocks.signInSocial.mockResolvedValue({ data: { url: "https://example.com", redirect: true }, error: null });
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Apple でログイン" }));

    await waitFor(() => {
      expect(mocks.signInSocial).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "apple" }),
      );
    });
  });

  it("?error=signup_disabled で戻された場合、未登録の案内と新規登録導線を表示する", async () => {
    // 未登録アカウントで social ログインすると better-auth が errorCallbackURL(=/login)へ
    // ?error=signup_disabled を付けてリダイレクトする。これを受けて案内を表示する。
    window.history.replaceState({}, "", "/login?error=signup_disabled");
    render(<LoginPage />);

    expect(
      await screen.findByText("このアカウントは登録されていません。新規登録してください。"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "新規登録" })).toBeInTheDocument();
  });

  it("再送信でメール入力ステップに戻る", async () => {
    mocks.sendVerificationOtp.mockResolvedValue({ data: { success: true }, error: null });
    render(<LoginPage />);

    await submitEmail();
    fireEvent.click(await screen.findByRole("button", { name: "再送信する" }));

    expect(await screen.findByLabelText("メールアドレス")).toBeInTheDocument();
  });
});
