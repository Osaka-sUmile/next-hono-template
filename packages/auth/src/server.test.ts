import { describe, it, expect, vi, beforeEach } from "vitest";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createAuth } from "./server";

// Resend をモックし、送信されたメール(subject / text)を捕捉する。
// OTP 本体はメール本文から抽出することで、実送信なしにサインインまで検証する。
const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));
vi.mock("resend", () => ({
  // クラスとしてモックし、new Resend() が確実にコンストラクタとして機能するようにする
  Resend: class {
    emails = { send: sendMock };
  },
}));

const baseConfig = {
  secret: "test-secret-value-at-least-32-chars-long-000",
  baseURL: "http://localhost:8787",
  webBaseURL: "http://localhost:3000",
  trustedOrigins: ["http://localhost:3000"],
  resendApiKey: "test-resend-key",
  resendFromEmail: "noreply@example.com",
  google: { clientId: "g-id", clientSecret: "g-secret" },
  apple: { clientId: "a-id", clientSecret: "a-secret" },
} satisfies Omit<Parameters<typeof createAuth>[0], "prisma" | "database">;

// database(memoryAdapter)を注入するため prisma は使われない。型を満たすためだけのスタブ。
const fakePrisma = {} as unknown as Parameters<typeof createAuth>[0]["prisma"];

function createTestAuth() {
  // memoryAdapter でインメモリ DB を使い、Postgres なしでサーバー統合テストを行う。
  // memoryAdapter は各モデルのテーブル(配列)が未定義だと例外を投げるため、空配列で初期化する。
  // db 参照を返し、User が作成された/されないことをテストから直接検証できるようにする。
  const db: Record<string, unknown[]> = { user: [], session: [], account: [], verification: [] };
  const auth = createAuth({ ...baseConfig, prisma: fakePrisma, database: memoryAdapter(db) });
  return { auth, db };
}

interface SentEmail {
  to: string;
  subject: string;
  text: string;
}

function lastEmail(): SentEmail {
  const call = sendMock.mock.calls.at(-1);
  if (!call) throw new Error("メールが送信されていません");
  return call[0] as SentEmail;
}

function extractOtp(text: string): string {
  const match = text.match(/(\d{4,8})/);
  if (!match) throw new Error(`OTP がメール本文に見つかりません: ${text}`);
  return match[1]!;
}

/** 新規登録(signUp: true)を完了させ、確立済みのユーザーを作る。 */
async function registerUser(
  auth: ReturnType<typeof createTestAuth>["auth"],
  email: string,
  displayName?: string,
) {
  await auth.api.sendVerificationOTP({
    body: { email, type: "sign-in" },
    headers: new Headers({ "x-signup-intent": "1" }),
  });
  const otp = extractOtp(lastEmail().text);
  return auth.api.signInEmailOTP({
    body: { email, otp, signUp: true, ...(displayName ? { displayName } : {}) },
  });
}

describe("createAuth / email OTP の契約 (refs #78)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // server.ts は send 結果の error を見て throw するため、成功レスポンスを返す
    sendMock.mockResolvedValue({ data: { id: "email-id" }, error: null });
  });

  // --- verify 側(hooks.before)---

  it("未登録メール + signUp なし → INVALID_OTP で拒否し、User を作成しない", async () => {
    const { auth, db } = createTestAuth();

    await expect(
      auth.api.signInEmailOTP({ body: { email: "nobody@example.com", otp: "123456" } }),
    ).rejects.toMatchObject({ status: "BAD_REQUEST", body: { code: "INVALID_OTP" } });

    expect(db.user ?? []).toHaveLength(0);
  });

  it("未登録メール + signUp: true + 正しい OTP → 新規登録が成功し、displayName が反映される", async () => {
    const { auth, db } = createTestAuth();

    const res = await registerUser(auth, "new@example.com", "新規太郎");

    expect(res.token).toBeTruthy();
    expect(db.user).toHaveLength(1);
    expect(db.user?.[0]).toMatchObject({ email: "new@example.com", displayName: "新規太郎" });
  });

  it("既存ユーザーのサインイン → 通常の OTP フローが継続する(フックが正常系に影響しない)", async () => {
    const { auth, db } = createTestAuth();
    await registerUser(auth, "existing@example.com");
    expect(db.user).toHaveLength(1);

    // signUp を付けずに(=ログイン)サインインできること
    await auth.api.sendVerificationOTP({ body: { email: "existing@example.com", type: "sign-in" } });
    const otp = extractOtp(lastEmail().text);
    const res = await auth.api.signInEmailOTP({ body: { email: "existing@example.com", otp } });

    expect(res.token).toBeTruthy();
    expect(db.user).toHaveLength(1); // 重複作成されない
  });

  // --- send 側(sendVerificationOTP フック)---

  it("未登録メール + x-signup-intent なし → OTP を送らず「アカウントが見つかりません」案内を送る", async () => {
    const { auth } = createTestAuth();

    const res = await auth.api.sendVerificationOTP({
      body: { email: "nobody@example.com", type: "sign-in" },
    });

    // 列挙防止のためレスポンスは success のまま
    expect(res.success).toBe(true);
    expect(lastEmail().subject).toBe("アカウントが見つかりません");
  });

  it("未登録メール + x-signup-intent: 1 → OTP メールを送る", async () => {
    const { auth } = createTestAuth();

    await auth.api.sendVerificationOTP({
      body: { email: "newuser@example.com", type: "sign-in" },
      headers: new Headers({ "x-signup-intent": "1" }),
    });

    expect(lastEmail().subject).toBe("認証コード");
  });

  it("登録済みメール + x-signup-intent なし → OTP メールを送る", async () => {
    const { auth } = createTestAuth();
    await registerUser(auth, "registered@example.com");

    await auth.api.sendVerificationOTP({
      body: { email: "registered@example.com", type: "sign-in" },
    });

    expect(lastEmail().subject).toBe("認証コード");
  });
});

describe("createAuth / social プロバイダの契約", () => {
  it("google / apple は disableImplicitSignUp が有効(ログインでの自動登録を抑止)", () => {
    const { auth } = createTestAuth();

    expect(auth.options.socialProviders?.google?.disableImplicitSignUp).toBe(true);
    expect(auth.options.socialProviders?.apple?.disableImplicitSignUp).toBe(true);
  });
});

describe("createAuth / Turnstile captcha (refs #41)", () => {
  it("turnstile 未設定なら captcha 検証を行わない(トークンなしでも OTP 送信が通る)", async () => {
    const { auth } = createTestAuth();

    const res = await auth.handler(
      new Request("http://localhost:8787/api/auth/email-otp/send-verification-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "nobody@example.com", type: "sign-in" }),
      }),
    );

    expect(res.status).toBe(200);
  });

  it("turnstile 設定時、保護対象エンドポイントへ x-captcha-response なしでリクエストすると 400 MISSING_RESPONSE を返す", async () => {
    const db: Record<string, unknown[]> = { user: [], session: [], account: [], verification: [] };
    const auth = createAuth({
      ...baseConfig,
      prisma: fakePrisma,
      database: memoryAdapter(db),
      turnstile: { secretKey: "1x0000000000000000000000000000000AA" },
    });

    const res = await auth.handler(
      new Request("http://localhost:8787/api/auth/email-otp/send-verification-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "nobody@example.com", type: "sign-in" }),
      }),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "Missing CAPTCHA response", code: "MISSING_RESPONSE" });
  });
});
