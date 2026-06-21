import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Response } from "express";
import { UserController } from "./user.controller";
import type { GetCurrentUserUseCase, UserResponseDto } from "../../application";
import type { AuthenticatedRequest } from "../middleware/require-auth.middleware";
import { ErrorCodes } from "../error-codes";

vi.mock("../../infrastructure/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

describe("UserController", () => {
  const mockExecute = vi.fn();
  const useCase = { execute: mockExecute } as unknown as GetCurrentUserUseCase;
  const controller = new UserController(useCase);

  beforeEach(() => {
    mockExecute.mockReset();
  });

  const makeReq = (userId = "user-1") =>
    ({ auth: { user: { id: userId } } }) as unknown as AuthenticatedRequest;

  const makeRes = () =>
    ({
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    }) as unknown as Response & {
      json: ReturnType<typeof vi.fn>;
      status: ReturnType<typeof vi.fn>;
    };

  it("returns 200 with user data when found", async () => {
    const user: UserResponseDto = {
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
      role: "user",
      displayName: null,
      image: null,
      emailVerified: false,
      createdAt: new Date("2024-01-01"),
    };
    mockExecute.mockResolvedValue(user);
    const res = makeRes();

    await controller.getUserMe(makeReq(), res);

    expect(res.json).toHaveBeenCalledWith(user);
  });

  it("returns 500 when user is not found despite valid session (data inconsistency)", async () => {
    mockExecute.mockResolvedValue(null);
    const res = makeRes();

    await controller.getUserMe(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal Server Error", code: ErrorCodes.INTERNAL_ERROR });
  });

  it("returns 500 when use case throws", async () => {
    mockExecute.mockRejectedValue(new Error("Unexpected error"));
    const res = makeRes();

    await controller.getUserMe(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal Server Error", code: ErrorCodes.INTERNAL_ERROR });
  });
});
