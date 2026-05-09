import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { createRequireAuth } from "./require-auth.middleware";
import type { AuthInstance } from "@workspace/auth/server";
import { ErrorCodes } from "../error-codes";

vi.mock("better-auth/node", () => ({
  fromNodeHeaders: (headers: unknown) => headers,
}));

vi.mock("../../infrastructure/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

describe("createRequireAuth", () => {
  const mockGetSession = vi.fn();
  const auth = {
    api: { getSession: mockGetSession },
  } as unknown as AuthInstance;

  const requireAuth = createRequireAuth(auth);

  beforeEach(() => {
    mockGetSession.mockReset();
  });

  it("returns 401 when session is null", async () => {
    mockGetSession.mockResolvedValue(null);
    const req = { headers: {} } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized", code: ErrorCodes.SESSION_INVALID });
    expect(next).not.toHaveBeenCalled();
  });

  it("sets req.auth and calls next when session exists", async () => {
    const session = { user: { id: "123" }, session: { id: "sess-1" } };
    mockGetSession.mockResolvedValue(session);
    const req = { headers: {} } as Request;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    await requireAuth(req, res, next);

    expect((req as unknown as Record<string, unknown>)["auth"]).toEqual(session);
    expect(next).toHaveBeenCalled();
  });

  it("returns 500 when getSession throws", async () => {
    mockGetSession.mockRejectedValue(new Error("Server error"));
    const req = { headers: {} } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal Server Error", code: ErrorCodes.SESSION_FETCH_FAILED });
  });

  it("returns 401 SESSION_EXPIRED when better-auth throws 401 with SESSION_EXPIRED code", async () => {
    const err = Object.assign(new Error("session expired"), {
      statusCode: 401,
      body: { code: "SESSION_EXPIRED" },
    });
    mockGetSession.mockRejectedValue(err);
    const req = { headers: {} } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Session expired", code: ErrorCodes.SESSION_EXPIRED });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 SESSION_INVALID when better-auth throws 401 without SESSION_EXPIRED code", async () => {
    const err = Object.assign(new Error("invalid token"), {
      statusCode: 401,
      body: { code: "INVALID_TOKEN" },
    });
    mockGetSession.mockRejectedValue(err);
    const req = { headers: {} } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized", code: ErrorCodes.SESSION_INVALID });
    expect(next).not.toHaveBeenCalled();
  });
});
