import { describe, expect, it } from "vitest";
import { createTestApp } from "../../test-utils";

describe("GET /api/v1/health", () => {
  it("returns ok status with a public cache header", async () => {
    const { app } = createTestApp();

    const res = await app.request("/api/v1/health");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    // ヘルスチェックは v1 デフォルトのキャッシュ方針を上書きする。
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
  });
});
