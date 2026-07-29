import { describe, expect, it } from "vitest"
import { InvalidArgumentError } from "../errors"
import { parseUserRole, InvalidUserRoleError, UserEntity } from "./user.entity"

describe("parseUserRole", () => {
  it("returns 'user' for valid 'user' role", () => {
    const role = parseUserRole("user")
    expect(role).toBe("user")
  })

  it("returns 'admin' for valid 'admin' role", () => {
    const role = parseUserRole("admin")
    expect(role).toBe("admin")
  })

  it("throws InvalidUserRoleError for invalid role", () => {
    expect(() => parseUserRole("superadmin")).toThrow(InvalidUserRoleError)
  })

  it("throws InvalidUserRoleError with correct message", () => {
    expect(() => parseUserRole("invalid")).toThrow(
      'Invalid UserRole: "invalid"'
    )
  })

  it("throws InvalidUserRoleError for empty string", () => {
    expect(() => parseUserRole("")).toThrow(InvalidUserRoleError)
  })
})

describe("InvalidUserRoleError", () => {
  it("extends Error", () => {
    const error = new InvalidUserRoleError("test")
    expect(error).toBeInstanceOf(Error)
  })

  it("has correct error name", () => {
    const error = new InvalidUserRoleError("test")
    expect(error.name).toBe("InvalidUserRoleError")
  })

  it("has correct error message", () => {
    const error = new InvalidUserRoleError("unknown")
    expect(error.message).toBe('Invalid UserRole: "unknown"')
  })
})

describe("UserEntity.changeDisplayName", () => {
  const createUser = (displayName: string | null = "元の名前") =>
    UserEntity.reconstitute(
      "user-1",
      "test@example.com",
      "Test User",
      "user",
      displayName
    )

  it("表示名を変更した新しいインスタンスを返し、元のインスタンスは変更されない", () => {
    const original = createUser("元の名前")
    const updated = original.changeDisplayName("新しい名前")

    expect(updated.displayName).toBe("新しい名前")
    expect(original.displayName).toBe("元の名前")
    expect(updated).not.toBe(original)
  })

  it("変更後のインスタンスの id/email/name/role が元と同一である", () => {
    const original = createUser("元の名前")
    const updated = original.changeDisplayName("新しい名前")

    expect(updated.id).toBe(original.id)
    expect(updated.email).toBe(original.email)
    expect(updated.name).toBe(original.name)
    expect(updated.role).toBe(original.role)
  })

  it("displayName に null を渡すと displayName が null になる", () => {
    const original = createUser("元の名前")
    const updated = original.changeDisplayName(null)

    expect(updated.displayName).toBeNull()
  })

  it("100文字ちょうどは成功する", () => {
    const displayName = "a".repeat(100)
    const updated = createUser(null).changeDisplayName(displayName)

    expect(updated.displayName).toBe(displayName)
  })

  it("101文字は InvalidArgumentError を throw する", () => {
    const displayName = "a".repeat(101)

    expect(() => createUser(null).changeDisplayName(displayName)).toThrow(
      InvalidArgumentError
    )
    expect(() => createUser(null).changeDisplayName(displayName)).toThrow(
      "displayName must be 100 characters or fewer"
    )
  })
})
