import { vi } from "vitest";
import type { Request, Response } from "express";

/**
 * Express の Request をモックするヘルパ。
 * 型パラメータで params/body/query を絞ることで、
 * controller が依存するプロパティを呼び出し側で必須にできる。
 */
export function mockRequest<
  P = Record<string, string>,
  B = unknown,
  Q = Record<string, string | string[] | undefined>,
>(overrides: Partial<Request<P, unknown, B, Q>> = {}): Request<P, unknown, B, Q> {
  return overrides as Request<P, unknown, B, Q>;
}

/**
 * status/json/send をモックした Response を返す。
 * Express の fluent API (`res.status(x).json(y)`) に追従するため、
 * status は this を返すよう実装している。
 */
export function mockResponse(): Response & {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
} {
  const res = {} as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  };
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.send = vi.fn(() => res);
  return res;
}
