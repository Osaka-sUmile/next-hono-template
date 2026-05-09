import { describe, expect, it } from "vitest";
import { parseUserRole, InvalidUserRoleError } from "./user.entity";

describe("parseUserRole", () => {
  it("returns 'user' for valid 'user' role", () => {
    const role = parseUserRole("user");
    expect(role).toBe("user");
  });

  it("returns 'admin' for valid 'admin' role", () => {
    const role = parseUserRole("admin");
    expect(role).toBe("admin");
  });

  it("throws InvalidUserRoleError for invalid role", () => {
    expect(() => parseUserRole("superadmin")).toThrow(InvalidUserRoleError);
  });

  it("throws InvalidUserRoleError with correct message", () => {
    expect(() => parseUserRole("invalid")).toThrow('Invalid UserRole: "invalid"');
  });

  it("throws InvalidUserRoleError for empty string", () => {
    expect(() => parseUserRole("")).toThrow(InvalidUserRoleError);
  });
});

describe("InvalidUserRoleError", () => {
  it("extends Error", () => {
    const error = new InvalidUserRoleError("test");
    expect(error).toBeInstanceOf(Error);
  });

  it("has correct error name", () => {
    const error = new InvalidUserRoleError("test");
    expect(error.name).toBe("InvalidUserRoleError");
  });

  it("has correct error message", () => {
    const error = new InvalidUserRoleError("unknown");
    expect(error.message).toBe('Invalid UserRole: "unknown"');
  });
});
