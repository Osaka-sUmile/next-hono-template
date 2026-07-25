import { describe, expect, it } from "vitest";
import { z } from "zod";
import { formatZodError } from "./format-zod-error";

describe("formatZodError", () => {
  it("formats paths and messages into the API error string", () => {
    const result = z.object({ profile: z.object({ name: z.string().min(2) }) }).safeParse({
      profile: { name: "" },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodError(result.error)).toBe("profile.name: Too small: expected string to have >=2 characters");
    }
  });
});
