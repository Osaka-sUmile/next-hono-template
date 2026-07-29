import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { createTestPrismaClient, resetDatabase } from "./index"

// resetDatabase は他の結合テストの独立性を支える基盤のため、それ自体を実 DB で検証する。
// (呼び出し側テストは truncate 後の状態を直接確認しないため、リセット不能でも通過し得る)
describe("resetDatabase (integration)", () => {
  let prisma: PrismaClient

  beforeAll(() => {
    prisma = createTestPrismaClient()
  })

  beforeEach(async () => {
    await resetDatabase(prisma)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it("public テーブルのレコードを削除し、_prisma_migrations は残す", async () => {
    await prisma.user.createMany({
      data: [
        { email: "a@example.com", name: "A" },
        { email: "b@example.com", name: "B" },
      ],
    })
    expect(await prisma.user.count()).toBe(2)

    await resetDatabase(prisma)

    expect(await prisma.user.count()).toBe(0)
    // マイグレーション状態は保持されていること (truncate 対象外)。
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)::bigint AS count FROM _prisma_migrations
    `
    expect(rows[0]?.count ?? 0n).toBeGreaterThan(0n)
  })
})
