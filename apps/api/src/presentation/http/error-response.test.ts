import { describe, expect, it, vi } from "vitest";
import type { Context } from "hono";
import { ErrorCodes } from "../errors";
import { errorResponse } from "./error-response";

function contextWithJson(json: ReturnType<typeof vi.fn>): Context {
  return { json } as unknown as Context;
}

describe("errorResponse", () => {
  it("calls c.json with the { error, code } body and the given status", () => {
    const json = vi.fn().mockReturnValue("RESPONSE");
    const c = contextWithJson(json);

    const result = errorResponse(c, 403, ErrorCodes.FORBIDDEN, "Forbidden");

    expect(json).toHaveBeenCalledWith({ error: "Forbidden", code: ErrorCodes.FORBIDDEN }, 403);
    // ヘルパーは c.json の戻り値をそのまま返す（Hono ハンドラの戻り Response になる）。
    expect(result).toBe("RESPONSE");
  });

  it("passes the message through as the error field verbatim", () => {
    const json = vi.fn();
    const c = contextWithJson(json);

    errorResponse(c, 400, ErrorCodes.VALIDATION_ERROR, "displayName: too long");

    expect(json).toHaveBeenCalledWith(
      { error: "displayName: too long", code: ErrorCodes.VALIDATION_ERROR },
      400,
    );
  });
});
