import { describe, expect, it, vi } from "vitest";
import type { Context } from "hono";
import { InvalidJsonBodyError } from "../errors";
import { readJsonBody } from "./read-json-body";

function contextWithJson(json: () => Promise<unknown>): Context {
  return { req: { json } } as unknown as Context;
}

describe("readJsonBody", () => {
  it("returns the parsed body on success", async () => {
    const c = contextWithJson(vi.fn().mockResolvedValue({ displayName: "New Name" }));

    await expect(readJsonBody(c)).resolves.toEqual({ displayName: "New Name" });
  });

  it("wraps a JSON SyntaxError into InvalidJsonBodyError (mapped to 400 by onError)", async () => {
    const c = contextWithJson(vi.fn().mockRejectedValue(new SyntaxError("Unexpected end of JSON input")));

    await expect(readJsonBody(c)).rejects.toBeInstanceOf(InvalidJsonBodyError);
  });

  it("rethrows a non-SyntaxError (e.g. TypeError from a consumed body) unchanged so it stays 500", async () => {
    const typeError = new TypeError("Body is unusable");
    const c = contextWithJson(vi.fn().mockRejectedValue(typeError));

    await expect(readJsonBody(c)).rejects.toBe(typeError);
  });
});
