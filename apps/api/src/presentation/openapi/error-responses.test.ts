import { describe, expect, it } from "vitest";
import { ErrorSchema } from "./error.schema";
import { errorResponses } from "./error-responses";

describe("errorResponses", () => {
  it("maps each status to its description and the shared ErrorSchema", () => {
    const responses = errorResponses({ 401: "Unauthorized", 500: "Internal server error" });

    expect(responses[401]).toEqual({
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    });
    expect(responses[500]).toEqual({
      description: "Internal server error",
      content: { "application/json": { schema: ErrorSchema } },
    });
  });
});
