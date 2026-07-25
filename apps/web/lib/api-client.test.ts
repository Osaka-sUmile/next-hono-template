import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError, apiClient, unwrap } from "./api-client";

vi.mock("./auth-client", () => ({
  apiBaseUrl: "http://localhost:8080",
  authClient: {},
}));

describe("apiClient / unwrap", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = fetchMock;
  });

  function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  it("baseUrl を前置し Cookie を送って GET する", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: "ok" }));

    await unwrap(apiClient.GET("/api/v1/health"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://localhost:8080/api/v1/health");
    expect(request.credentials).toBe("include");
  });

  it("unwrap は成功時に data を返す", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: "ok" }));

    await expect(unwrap(apiClient.GET("/api/v1/health"))).resolves.toEqual({ status: "ok" });
  });

  it("body ありのリクエストには Content-Type: application/json が付く", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ displayName: "太郎" }));

    await unwrap(apiClient.PATCH("/api/v1/me", { body: { displayName: "太郎" } }));

    const request = fetchMock.mock.calls[0]?.[0] as Request;
    expect(request.headers.get("Content-Type")).toBe("application/json");
    expect(await request.clone().json()).toEqual({ displayName: "太郎" });
  });

  it("null を body に渡しても JSON として送る", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await unwrap(apiClient.PATCH("/api/v1/me", { body: { displayName: null } }));

    const request = fetchMock.mock.calls[0]?.[0] as Request;
    expect(await request.clone().json()).toEqual({ displayName: null });
  });

  it("呼び出し側が credentials を上書きしようとしても include が維持される", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: "ok" }));

    // Cookie セッション認証が静かに壊れるのを防ぐため、呼び出し側からは無効化できない。
    await unwrap(apiClient.GET("/api/v1/health", { credentials: "omit" }));

    const request = fetchMock.mock.calls[0]?.[0] as Request;
    expect(request.credentials).toBe("include");
  });

  it("unwrap は 4xx で ApiError を投げ status を保持する", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({}, 401)));

    const error = await unwrap(apiClient.GET("/api/v1/me")).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ name: "ApiError", status: 401 });
  });

  it("unwrap は 5xx でも ApiError を投げ status を保持する", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500));

    await expect(
      unwrap(apiClient.PATCH("/api/v1/me", { body: { displayName: "太郎" } })),
    ).rejects.toMatchObject({ status: 500 });
  });
});
