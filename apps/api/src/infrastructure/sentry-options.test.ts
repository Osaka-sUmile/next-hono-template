import { describe, expect, it } from "vitest";
import { resolveSentryOptions } from "./sentry-options";

const DSN = "https://public@o0.ingest.sentry.io/0";

describe("resolveSentryOptions", () => {
  describe("Sentry の有効・無効", () => {
    it("SENTRY_DSN が未設定なら undefined を返し Sentry を無効にする", () => {
      expect(resolveSentryOptions({ NODE_ENV: "production" })).toBeUndefined();
    });

    it("SENTRY_DSN が空文字なら undefined を返す", () => {
      expect(resolveSentryOptions({ SENTRY_DSN: "" })).toBeUndefined();
    });

    it("SENTRY_DSN が文字列でなければ undefined を返す", () => {
      expect(resolveSentryOptions({ SENTRY_DSN: null })).toBeUndefined();
    });

    it("SENTRY_DSN があれば dsn を返す", () => {
      expect(resolveSentryOptions({ SENTRY_DSN: DSN })?.dsn).toBe(DSN);
    });
  });

  describe("environment の解決", () => {
    it("SENTRY_ENVIRONMENT を NODE_ENV より優先する", () => {
      const options = resolveSentryOptions({
        SENTRY_DSN: DSN,
        SENTRY_ENVIRONMENT: "preview",
        NODE_ENV: "production",
      });
      expect(options?.environment).toBe("preview");
    });

    it("SENTRY_ENVIRONMENT が空文字なら NODE_ENV にフォールバックする", () => {
      const options = resolveSentryOptions({
        SENTRY_DSN: DSN,
        SENTRY_ENVIRONMENT: "",
        NODE_ENV: "development",
      });
      expect(options?.environment).toBe("development");
    });

    it("SENTRY_ENVIRONMENT が空白のみなら trim して NODE_ENV にフォールバックする", () => {
      const options = resolveSentryOptions({
        SENTRY_DSN: DSN,
        SENTRY_ENVIRONMENT: "   ",
        NODE_ENV: " production ",
      });
      expect(options?.environment).toBe("production");
    });

    it("どちらも未設定なら environment は undefined", () => {
      expect(resolveSentryOptions({ SENTRY_DSN: DSN })?.environment).toBeUndefined();
    });
  });

  describe("tracesSampleRate", () => {
    // 率の解釈そのもの（環境別既定値・境界値・無効値のフォールバック）は
    // @workspace/common の resolveTracesSampleRate 側でテスト済みのため、ここでは
    // api 固有の責務（生 binding からの変換、共有関数との結線）だけを確認する。

    it("SENTRY_ENVIRONMENT=production なら 0.1 になる（共有関数との結線確認）", () => {
      const options = resolveSentryOptions({ SENTRY_DSN: DSN, SENTRY_ENVIRONMENT: "production" });
      expect(options?.tracesSampleRate).toBe(0.1);
    });

    it("SENTRY_TRACES_SAMPLE_RATE が有効な文字列なら上書きされる（共有関数との結線確認）", () => {
      const options = resolveSentryOptions({
        SENTRY_DSN: DSN,
        SENTRY_ENVIRONMENT: "production",
        SENTRY_TRACES_SAMPLE_RATE: "0.5",
      });
      expect(options?.tracesSampleRate).toBe(0.5);
    });

    it.each([
      ["数値", 0.5],
      ["null", null],
    ])(
      "SENTRY_TRACES_SAMPLE_RATE が文字列でない（%s）場合は readNonEmptyString で undefined に変換され既定値になる",
      (_label, raw) => {
        const options = resolveSentryOptions({
          SENTRY_DSN: DSN,
          SENTRY_ENVIRONMENT: "production",
          SENTRY_TRACES_SAMPLE_RATE: raw,
        });
        expect(options?.tracesSampleRate).toBe(0.1);
      },
    );
  });
});
