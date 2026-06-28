import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { createErrorHandler } from "./error-handler.middleware";
import { ErrorCodes } from "../error-codes";

const mockEnv = { NODE_ENV: "development" as "development" | "test" | "production" };

vi.mock("../../infrastructure/env", () => ({
  get env() {
    return mockEnv;
  },
}));

vi.mock("../../infrastructure/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

function createMockRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

describe("createErrorHandler", () => {
  const handler = createErrorHandler();
  const req = { headers: {} } as Request;
  const next = vi.fn() as unknown as NextFunction;

  beforeEach(() => {
    mockEnv.NODE_ENV = "development";
  });

  it("returns 500 with INTERNAL_ERROR code for an Error instance", () => {
    const res = createMockRes();

    handler(new Error("boom"), req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "boom", code: ErrorCodes.INTERNAL_ERROR });
  });

  it("exposes err.message in development", () => {
    mockEnv.NODE_ENV = "development";
    const res = createMockRes();

    handler(new Error("detailed dev message"), req, res, next);

    expect(res.json).toHaveBeenCalledWith({ error: "detailed dev message", code: ErrorCodes.INTERNAL_ERROR });
  });

  it("hides err.message in production", () => {
    mockEnv.NODE_ENV = "production";
    const res = createMockRes();

    handler(new Error("detailed dev message"), req, res, next);

    expect(res.json).toHaveBeenCalledWith({ error: "Internal Server Error", code: ErrorCodes.INTERNAL_ERROR });
  });

  it("falls back to a generic message for non-Error values", () => {
    const res = createMockRes();

    handler("just a string", req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal Server Error", code: ErrorCodes.INTERNAL_ERROR });
  });
});
