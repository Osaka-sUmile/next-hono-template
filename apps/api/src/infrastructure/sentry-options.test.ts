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

    it("どちらも未設定なら environment は undefined", () => {
      expect(resolveSentryOptions({ SENTRY_DSN: DSN })?.environment).toBeUndefined();
    });
  });

  describe("tracesSampleRate の既定値", () => {
    it.each([
      ["production", 0.1],
      ["preview", 0.2],
      ["development", 1],
    ])("SENTRY_ENVIRONMENT=%s なら %s", (environment, expected) => {
      const options = resolveSentryOptions({ SENTRY_DSN: DSN, SENTRY_ENVIRONMENT: environment });
      expect(options?.tracesSampleRate).toBe(expected);
    });

    it("environment が未設定なら 1（開発扱いで全件送る）", () => {
      expect(resolveSentryOptions({ SENTRY_DSN: DSN })?.tracesSampleRate).toBe(1);
    });

    it("preview / production の既定値は NODE_ENV ではなく SENTRY_ENVIRONMENT で決まる", () => {
      // preview / production はどちらも NODE_ENV=production のため、NODE_ENV では区別できない。
      const options = resolveSentryOptions({
        SENTRY_DSN: DSN,
        SENTRY_ENVIRONMENT: "preview",
        NODE_ENV: "production",
      });
      expect(options?.tracesSampleRate).toBe(0.2);
    });
  });

  describe("SENTRY_TRACES_SAMPLE_RATE による上書き", () => {
    it("有効な値なら環境の既定値を上書きする", () => {
      const options = resolveSentryOptions({
        SENTRY_DSN: DSN,
        SENTRY_ENVIRONMENT: "production",
        SENTRY_TRACES_SAMPLE_RATE: "0.5",
      });
      expect(options?.tracesSampleRate).toBe(0.5);
    });

    it.each([
      ["0", 0],
      ["1", 1],
    ])("境界値 %s を受け付ける", (raw, expected) => {
      const options = resolveSentryOptions({
        SENTRY_DSN: DSN,
        SENTRY_ENVIRONMENT: "production",
        SENTRY_TRACES_SAMPLE_RATE: raw,
      });
      expect(options?.tracesSampleRate).toBe(expected);
    });

    it.each([
      ["非数値", "abc"],
      ["空文字", ""],
      ["負の値", "-0.1"],
      ["1 超過", "1.5"],
      ["空白のみ", "   "],
      ["文字列でない", 0.5],
      ["null", null],
    ])("%s は無効として既定値にフォールバックする", (_label, raw) => {
      const options = resolveSentryOptions({
        SENTRY_DSN: DSN,
        SENTRY_ENVIRONMENT: "production",
        SENTRY_TRACES_SAMPLE_RATE: raw,
      });
      expect(options?.tracesSampleRate).toBe(0.1);
    });
  });
});
