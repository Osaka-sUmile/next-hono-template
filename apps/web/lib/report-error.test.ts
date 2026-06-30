import { describe, it, expect, vi, beforeEach } from "vitest";
import { reportError, ExpectedError } from "./report-error";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import * as Sentry from "@sentry/nextjs";

describe("reportError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ExpectedError は Sentry に送信しない", () => {
    reportError(new ExpectedError("想定内"));
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("通常の Error は Sentry に送信する", () => {
    const error = new Error("unexpected");
    reportError(error);
    expect(Sentry.captureException).toHaveBeenCalledOnce();
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it("文字列など非 Error も Sentry に送信する（fail-loud）", () => {
    reportError("something went wrong");
    expect(Sentry.captureException).toHaveBeenCalledOnce();
  });

  it("null / undefined も Sentry に送信する（fail-loud）", () => {
    reportError(null);
    expect(Sentry.captureException).toHaveBeenCalledOnce();
  });
});
