import { describe, expect, it, vi } from "vitest"
import type { IUserRepository } from "@workspace/domain"
import { UserEntity } from "@workspace/domain"
import { UpdateUserProfileUseCase } from "./update-user-profile.use-case"

const createUser = (displayName: string | null = null) =>
  UserEntity.reconstitute(
    "user-1",
    "test@example.com",
    "Test User",
    "user",
    displayName
  )

const createRepository = (
  findById: ReturnType<typeof vi.fn>,
  save?: ReturnType<typeof vi.fn>
) =>
  ({
    findById,
    save: save ?? vi.fn(),
    delete: vi.fn(),
  }) as unknown as IUserRepository

describe("UpdateUserProfileUseCase", () => {
  it("既存ユーザーの表示名を更新して返す", async () => {
    const user = createUser(null)
    const save = vi
      .fn()
      .mockImplementation(async (entity: UserEntity) => entity)
    const useCase = new UpdateUserProfileUseCase(
      createRepository(vi.fn().mockResolvedValue(user), save)
    )

    const result = await useCase.execute({
      userId: "user-1",
      displayName: "新しい名前",
    })

    expect(result).toEqual({
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
      role: "user",
      displayName: "新しい名前",
    })
    expect(save).toHaveBeenCalledTimes(1)
    expect((save.mock.calls[0]?.[0] as UserEntity).displayName).toBe(
      "新しい名前"
    )
  })

  it("displayName に null を渡すと表示名をクリアする", async () => {
    const user = createUser("既存の名前")
    const save = vi
      .fn()
      .mockImplementation(async (entity: UserEntity) => entity)
    const useCase = new UpdateUserProfileUseCase(
      createRepository(vi.fn().mockResolvedValue(user), save)
    )

    const result = await useCase.execute({
      userId: "user-1",
      displayName: null,
    })

    expect(result.displayName).toBeNull()
  })

  it("findById が null を返すと data inconsistency エラーで reject し、save は呼ばれない", async () => {
    const save = vi.fn()
    const useCase = new UpdateUserProfileUseCase(
      createRepository(vi.fn().mockResolvedValue(null), save)
    )

    await expect(
      useCase.execute({ userId: "user-1", displayName: "新しい名前" })
    ).rejects.toThrow(/data inconsistency/)
    expect(save).not.toHaveBeenCalled()
  })

  it("findById が null を返しても例外メッセージに userId を埋め込まない", async () => {
    // Sentry の issue 分裂・識別子の露出範囲拡大を防ぐため、message は固定文言にする。
    const save = vi.fn()
    const useCase = new UpdateUserProfileUseCase(
      createRepository(vi.fn().mockResolvedValue(null), save)
    )

    let error: unknown
    try {
      await useCase.execute({ userId: "user-1", displayName: "新しい名前" })
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).not.toContain("user-1")
  })
})
