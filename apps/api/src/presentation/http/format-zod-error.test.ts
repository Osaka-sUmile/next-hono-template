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

  it("formats root-level issues without a path", () => {
    const result = z.string().min(2).safeParse("");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodError(result.error)).toBe("Too small: expected string to have >=2 characters");
    }
  });

  it("joins multiple issues with a semicolon", () => {
    const result = z.object({ name: z.string().min(2), email: z.email() }).safeParse({ name: "", email: "invalid" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodError(result.error)).toBe(
        "name: Too small: expected string to have >=2 characters; email: Invalid email address",
      );
    }
  });
});
