import { describe, expect, it } from "vitest";
import { resolveTracesSampleRate } from "./sentry-traces-sample-rate";

describe("resolveTracesSampleRate", () => {
  describe("環境ごとの既定値", () => {
    it.each([
      ["production", 0.1],
      ["preview", 0.2],
      ["development", 1],
      ["test", 1],
    ])("environment=%s なら %s", (environment, expected) => {
      expect(resolveTracesSampleRate(undefined, environment)).toBe(expected);
    });

    it("environment が未設定なら 1（全件送る）", () => {
      expect(resolveTracesSampleRate(undefined, undefined)).toBe(1);
    });

    it("未知の環境名なら 1", () => {
      expect(resolveTracesSampleRate(undefined, "staging")).toBe(1);
    });
  });

  describe("上書き値", () => {
    it("有効な値なら環境の既定値を上書きする", () => {
      expect(resolveTracesSampleRate("0.5", "production")).toBe(0.5);
    });

    it.each([
      ["0", 0],
      ["1", 1],
    ])("境界値 %s を受け付ける", (raw, expected) => {
      expect(resolveTracesSampleRate(raw, "production")).toBe(expected);
    });

    it.each([
      ["非数値", "abc"],
      ["空文字", ""],
      ["空白のみ", "   "],
      ["負の値", "-0.1"],
      ["1 超過", "1.5"],
      ["未設定", undefined],
    ])("%s は無効として既定値にフォールバックする", (_label, raw) => {
      expect(resolveTracesSampleRate(raw, "production")).toBe(0.1);
    });
  });
});
