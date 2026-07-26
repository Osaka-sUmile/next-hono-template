import { describe, expect, it } from "vitest";
import { resolveSentryEnvironment } from "./sentry-environment";

describe("resolveSentryEnvironment", () => {
  it("優先値を trim して返す", () => {
    expect(resolveSentryEnvironment(" preview ", "production")).toBe("preview");
  });

  it.each([
    ["空文字", ""],
    ["空白のみ", "   "],
    ["非文字列", null],
  ])("優先値が%sなら fallback を返す", (_label, preferred) => {
    expect(resolveSentryEnvironment(preferred, " production ")).toBe("production");
  });

  it("両方が無効なら undefined を返す", () => {
    expect(resolveSentryEnvironment(" ", undefined)).toBeUndefined();
  });
});
