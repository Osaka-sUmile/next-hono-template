import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";
import { ErrorCodes } from "../errors";
import { ErrorSchema } from "./error.schema";

describe("ErrorSchema", () => {
  it("requires the established error body and accepts only ErrorCodes", () => {
    expect(ErrorSchema.safeParse({ error: "Unauthorized", code: ErrorCodes.SESSION_INVALID }).success).toBe(true);
    expect(ErrorSchema.safeParse({ code: ErrorCodes.SESSION_INVALID }).success).toBe(false);
    expect(ErrorSchema.safeParse({ error: "Unknown", code: "UNKNOWN" }).success).toBe(false);
  });

  it("is emitted as the named Error OpenAPI schema", () => {
    const app = new OpenAPIHono();
    app.openapi(
      createRoute({
        method: "get",
        path: "/error",
        responses: { 400: { description: "Error", content: { "application/json": { schema: ErrorSchema } } } },
      }),
      (c) => c.json({ error: "Invalid", code: ErrorCodes.VALIDATION_ERROR }, 400),
    );

    const document = app.getOpenAPIDocument({ openapi: "3.0.3", info: { title: "Test", version: "1" } });

    expect(document.components?.schemas?.Error).toMatchObject({
      type: "object",
      required: expect.arrayContaining(["error", "code"]),
      properties: expect.objectContaining({
        error: expect.objectContaining({ type: "string" }),
        code: expect.objectContaining({ enum: expect.arrayContaining(Object.values(ErrorCodes)) }),
      }),
    });
  });
});
