import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { UserEntity } from "@workspace/domain"
import { UserPrismaRepository } from "./user.prisma-repository"
import { createTestPrismaClient, resetDatabase } from "../test-utils"

// 書き込み系リポジトリを実 DB に対して検証する。
// 最低ケース: 往復 (save → findById で復元一致) / null 系 / 更新の反映 / 削除。
describe("UserPrismaRepository (integration)", () => {
  let prisma: PrismaClient
  let repository: UserPrismaRepository

  // 接続リークを避けるため PrismaClient は一度だけ生成し、各テストの独立性は
  // beforeEach の resetDatabase (truncate) で担保する。
  beforeAll(() => {
    prisma = createTestPrismaClient()
    repository = new UserPrismaRepository(prisma)
  })

  beforeEach(async () => {
    await resetDatabase(prisma)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it("save で作成したユーザーを findById で復元でき、値が一致する", async () => {
    const entity = UserEntity.reconstitute(
      "user-1",
      "roundtrip@example.com",
      "Round Trip",
      "admin",
      "RT"
    )

    await repository.save(entity)
    const found = await repository.findById("user-1")

    expect(found).not.toBeNull()
    expect(found?.id).toBe("user-1")
    expect(found?.email).toBe("roundtrip@example.com")
    expect(found?.name).toBe("Round Trip")
    expect(found?.role).toBe("admin")
    expect(found?.displayName).toBe("RT")
  })

  it("存在しない id の findById は null を返す", async () => {
    await expect(repository.findById("missing")).resolves.toBeNull()
  })

  it("既存ユーザーへの save は name / role / displayName を更新する", async () => {
    await repository.save(
      UserEntity.reconstitute(
        "user-2",
        "update@example.com",
        "Before",
        "user",
        null
      )
    )

    await repository.save(
      UserEntity.reconstitute(
        "user-2",
        "update@example.com",
        "After",
        "admin",
        "Nick"
      )
    )
    const found = await repository.findById("user-2")

    expect(found?.name).toBe("After")
    expect(found?.role).toBe("admin")
    expect(found?.displayName).toBe("Nick")
  })

  it("delete でユーザーを削除する", async () => {
    const entity = UserEntity.reconstitute(
      "user-3",
      "delete@example.com",
      "To Delete",
      "user",
      null
    )
    await repository.save(entity)

    await repository.delete(entity)

    await expect(repository.findById("user-3")).resolves.toBeNull()
  })

  it("別 id で同一 email を save すると email の一意制約に違反して失敗する", async () => {
    await repository.save(
      UserEntity.reconstitute(
        "user-a",
        "dup@example.com",
        "First",
        "user",
        null
      )
    )

    // save は upsert({ where: { id } }) で id をキーに分岐するため、別 id + 同一 email は
    // create 経路に入り User.email の @unique に違反する。制約エラーがそのまま伝播することを確認する。
    const duplicate = UserEntity.reconstitute(
      "user-b",
      "dup@example.com",
      "Second",
      "user",
      null
    )

    await expect(repository.save(duplicate)).rejects.toMatchObject({
      code: "P2002",
    })

    // 制約違反時に 2 件目 (user-b) が部分的に書き込まれないことを確認する。
    await expect(repository.findById("user-b")).resolves.toBeNull()
  })
})
