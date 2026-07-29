import { describe, expect, it, vi } from "vitest"
import type { IUserQueryService, UserQueryResult } from "@workspace/domain"
import { ListUsersUseCase } from "./list-users.use-case"

const buildQueryResult = (
  overrides: Partial<UserQueryResult> = {}
): UserQueryResult => ({
  id: "u1",
  email: "user@example.com",
  name: "User One",
  role: "user",
  displayName: null,
  image: null,
  emailVerified: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
})

const createQueryService = (
  findAll: ReturnType<typeof vi.fn>
): IUserQueryService =>
  ({ findById: vi.fn(), findAll }) as unknown as IUserQueryService

describe("ListUsersUseCase", () => {
  it("findAll の結果を UserResponseDto の配列に変換して返す", async () => {
    const results: UserQueryResult[] = [
      buildQueryResult({ id: "u1", role: "admin" }),
      buildQueryResult({ id: "u2", role: "user", displayName: "Two" }),
    ]
    const useCase = new ListUsersUseCase(
      createQueryService(vi.fn().mockResolvedValue(results))
    )

    const dtos = await useCase.execute()

    expect(dtos).toEqual([
      {
        id: "u1",
        email: "user@example.com",
        name: "User One",
        role: "admin",
        displayName: null,
        image: null,
        emailVerified: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        id: "u2",
        email: "user@example.com",
        name: "User One",
        role: "user",
        displayName: "Two",
        image: null,
        emailVerified: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ])
  })

  it("ユーザーが存在しない場合は空配列を返す", async () => {
    const useCase = new ListUsersUseCase(
      createQueryService(vi.fn().mockResolvedValue([]))
    )

    await expect(useCase.execute()).resolves.toEqual([])
  })

  it("findAll が例外を投げた場合はそのまま reject する", async () => {
    const error = new Error("query failed")
    const useCase = new ListUsersUseCase(
      createQueryService(vi.fn().mockRejectedValue(error))
    )

    await expect(useCase.execute()).rejects.toBe(error)
  })
})
