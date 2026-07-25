import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError, apiClient } from "./api-client";

vi.mock("./auth-client", () => ({
  apiBaseUrl: "http://localhost:8080",
  authClient: {},
}));

describe("apiClient", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = fetchMock;
  });

  function jsonResponse(body: unknown, status = 200) {
    return { ok: status >= 200 && status < 300, status, json: vi.fn().mockResolvedValue(body) };
  }

  it("get は apiBaseUrl を前置し Cookie を送り、JSON を返す", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "u1" }));

    await expect(apiClient.get("/api/v1/me")).resolves.toEqual({ id: "u1" });

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8080/api/v1/me", {
      method: "GET",
      credentials: "include",
      headers: {},
    });
  });

  it("body のないリクエストには Content-Type を付けない", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await apiClient.get("/api/v1/health");

    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty("body");
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({});
  });

  it("patch は body を JSON 化し Content-Type を付ける", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ displayName: "太郎" }));

    await expect(apiClient.patch("/api/v1/me", { displayName: "太郎" })).resolves.toEqual({
      displayName: "太郎",
    });

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8080/api/v1/me", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "太郎" }),
    });
  });

  it("post は body を JSON 化する", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await apiClient.post("/api/v1/things", { name: "x" });

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ name: "x" }),
    });
  });

  it("null を body に渡しても JSON として送る", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await apiClient.patch("/api/v1/me", { displayName: null });

    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ displayName: null }));
  });

  it("204 応答では json() を呼ばず undefined を返す", async () => {
    const res = { ok: true, status: 204, json: vi.fn() };
    fetchMock.mockResolvedValue(res);

    await expect(apiClient.delete("/api/v1/things/1")).resolves.toBeUndefined();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("4xx では ApiError を投げ status を保持する", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 401));

    await expect(apiClient.get("/api/v1/me")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
    });
    await expect(apiClient.get("/api/v1/me")).rejects.toBeInstanceOf(ApiError);
  });

  it("5xx でも ApiError を投げ status を保持する", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500));

    await expect(apiClient.patch("/api/v1/me", {})).rejects.toMatchObject({ status: 500 });
  });

  it("エラー時は本文の JSON を読まない（レスポンス形式に依存しない）", async () => {
    const res = jsonResponse({}, 500);
    fetchMock.mockResolvedValue(res);

    await expect(apiClient.get("/api/v1/me")).rejects.toBeInstanceOf(ApiError);
    expect(res.json).not.toHaveBeenCalled();
  });

  it("呼び出し側の headers はマージされ、credentials は上書きできない", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await apiClient.get("/api/v1/me", { headers: { "Accept-Language": "ja" } });

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      credentials: "include",
      headers: { "Accept-Language": "ja" },
    });
  });

  it("body があるとき Content-Type は呼び出し側から上書きできない", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await apiClient.patch(
      "/api/v1/me",
      { displayName: "太郎" },
      { headers: { "Content-Type": "text/plain", "Accept-Language": "ja" } },
    );

    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({
      "Content-Type": "application/json",
      "Accept-Language": "ja",
    });
  });
});
