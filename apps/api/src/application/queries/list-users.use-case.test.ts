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
  search: ReturnType<typeof vi.fn>
): IUserQueryService =>
  ({ findById: vi.fn(), search }) as unknown as IUserQueryService

describe("ListUsersUseCase", () => {
  it("検索条件を渡し、ページ情報を含む DTO に変換して返す", async () => {
    const results: UserQueryResult[] = [
      buildQueryResult({ id: "u1", role: "admin" }),
      buildQueryResult({ id: "u2", role: "user", displayName: "Two" }),
    ]
    const search = vi.fn().mockResolvedValue({ items: results, total: 12 })
    const useCase = new ListUsersUseCase(createQueryService(search))

    const dtos = await useCase.execute({
      limit: 2,
      offset: 4,
      search: "two",
      role: "user",
    })

    expect(search).toHaveBeenCalledWith({
      limit: 2,
      offset: 4,
      search: "two",
      role: "user",
    })
    expect(dtos).toEqual({
      items: [
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
      ],
      total: 12,
      limit: 2,
      offset: 4,
    })
  })

  it("任意条件が未指定なら undefined キーを query service に渡さない", async () => {
    const search = vi.fn().mockResolvedValue({ items: [], total: 0 })
    const useCase = new ListUsersUseCase(createQueryService(search))

    await expect(useCase.execute({ limit: 20, offset: 0 })).resolves.toEqual({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    })
    expect(search).toHaveBeenCalledWith({ limit: 20, offset: 0 })
  })

  it("search が例外を投げた場合はそのまま reject する", async () => {
    const error = new Error("query failed")
    const useCase = new ListUsersUseCase(
      createQueryService(vi.fn().mockRejectedValue(error))
    )

    await expect(useCase.execute({ limit: 20, offset: 0 })).rejects.toBe(error)
  })
})
