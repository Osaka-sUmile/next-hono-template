import { describe, expect, it } from "vitest"
import * as domainModule from "../index"
import {
  DomainError,
  DomainInvariantError,
  DomainRuleViolationError,
} from "./index"

describe("DomainError classification", () => {
  it("classifies every public DomainError descendant as exactly one global category", () => {
    const categoryBases = new Set<unknown>([
      DomainError,
      DomainInvariantError,
      DomainRuleViolationError,
    ])

    const incorrectlyClassifiedErrorNames = Object.entries(
      domainModule
    ).flatMap(([name, exported]) => {
      if (
        typeof exported !== "function" ||
        categoryBases.has(exported) ||
        !(exported.prototype instanceof DomainError)
      ) {
        return []
      }

      const categoryCount = [
        exported.prototype instanceof DomainInvariantError,
        exported.prototype instanceof DomainRuleViolationError,
      ].filter(Boolean).length

      return categoryCount === 1 ? [] : [name]
    })

    expect(incorrectlyClassifiedErrorNames).toEqual([])
  })
})
