import { describe, expect, it } from "vitest"
import { UuidIdGenerator } from "./uuid-id-generator"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

describe("UuidIdGenerator", () => {
  it("generates a UUID-shaped identifier", () => {
    expect(new UuidIdGenerator().generate()).toMatch(UUID_PATTERN)
  })

  it("generates a different identifier on each call", () => {
    const generator = new UuidIdGenerator()
    const ids = new Set(Array.from({ length: 100 }, () => generator.generate()))

    expect(ids.size).toBe(100)
  })
})
