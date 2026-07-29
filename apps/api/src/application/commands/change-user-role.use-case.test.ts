import { describe, expect, it, vi } from "vitest"
import type { IUserRepository } from "@workspace/domain"
import { UserEntity } from "@workspace/domain"
import {
  CannotChangeOwnRoleError,
  UserNotFoundError,
} from "../errors/user.error"
import { ChangeUserRoleUseCase } from "./change-user-role.use-case"

const createUser = (role: "user" | "admin") =>
  UserEntity.reconstitute(
    "target-1",
    "target@example.com",
    "Target User",
    role,
    "Target"
  )

function createRepository(
  findById: ReturnType<typeof vi.fn>,
  save: ReturnType<typeof vi.fn> = vi.fn()
): IUserRepository {
  return {
    findById,
    save,
    delete: vi.fn(),
  } as unknown as IUserRepository
}

describe("ChangeUserRoleUseCase", () => {
  it("promotes a user, saves the changed entity, and returns the saved DTO without mutating the original", async () => {
    const original = createUser("user")
    const save = vi
      .fn()
      .mockImplementation(async (entity: UserEntity) => entity)
    const useCase = new ChangeUserRoleUseCase(
      createRepository(vi.fn().mockResolvedValue(original), save)
    )

    const result = await useCase.execute({
      actorUserId: "admin-1",
      targetUserId: "target-1",
      role: "admin",
    })

    expect(save).toHaveBeenCalledOnce()
    expect((save.mock.calls[0]?.[0] as UserEntity).role).toBe("admin")
    expect(original.role).toBe("user")
    expect(result).toEqual({
      id: "target-1",
      email: "target@example.com",
      name: "Target User",
      role: "admin",
      displayName: "Target",
    })
  })

  it("demotes an admin user", async () => {
    const save = vi
      .fn()
      .mockImplementation(async (entity: UserEntity) => entity)
    const useCase = new ChangeUserRoleUseCase(
      createRepository(vi.fn().mockResolvedValue(createUser("admin")), save)
    )

    const result = await useCase.execute({
      actorUserId: "admin-1",
      targetUserId: "target-1",
      role: "user",
    })

    expect((save.mock.calls[0]?.[0] as UserEntity).role).toBe("user")
    expect(result.role).toBe("user")
  })

  it("rejects every self role change before reading or writing the repository", async () => {
    const findById = vi.fn()
    const save = vi.fn()
    const useCase = new ChangeUserRoleUseCase(createRepository(findById, save))

    await expect(
      useCase.execute({
        actorUserId: "admin-1",
        targetUserId: "admin-1",
        role: "admin",
      })
    ).rejects.toBeInstanceOf(CannotChangeOwnRoleError)
    expect(findById).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })

  it("throws UserNotFoundError and does not save for an unknown user", async () => {
    const save = vi.fn()
    const useCase = new ChangeUserRoleUseCase(
      createRepository(vi.fn().mockResolvedValue(null), save)
    )

    await expect(
      useCase.execute({
        actorUserId: "admin-1",
        targetUserId: "missing-user",
        role: "admin",
      })
    ).rejects.toBeInstanceOf(UserNotFoundError)
    expect(save).not.toHaveBeenCalled()
  })
})
