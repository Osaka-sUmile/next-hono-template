import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { UserQueryService } from "./user.query-service"
import { createTestPrismaClient, resetDatabase } from "../test-utils"

// 読み取り専用の query-service を実 DB に対して検証する。
// 前提データは prisma で直接投入し、期待する DTO の形と値・空結果・境界値を確認する。
// 書き込み経路 (save→findById 往復) は repository 側のテストが担うため、ここでは要求しない。
describe("UserQueryService (integration)", () => {
  let prisma: PrismaClient
  let queryService: UserQueryService

  // 接続リークを避けるため PrismaClient は一度だけ生成し、各テストの独立性は
  // beforeEach の resetDatabase (truncate) で担保する。
  beforeAll(() => {
    prisma = createTestPrismaClient()
    queryService = new UserQueryService(prisma)
  })

  beforeEach(async () => {
    await resetDatabase(prisma)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe("findById", () => {
    it("投入したユーザーを読み取り専用 DTO の形と値で返す", async () => {
      const created = await prisma.user.create({
        data: {
          email: "admin@example.com",
          name: "Admin User",
          role: "admin",
          displayName: "Boss",
          emailVerified: true,
        },
      })

      const result = await queryService.findById(created.id)

      expect(result).toEqual({
        id: created.id,
        email: "admin@example.com",
        name: "Admin User",
        role: "admin",
        displayName: "Boss",
        image: null,
        emailVerified: true,
        createdAt: created.createdAt,
      })
    })

    it("存在しない id の場合は null を返す", async () => {
      await expect(queryService.findById("missing-id")).resolves.toBeNull()
    })

    it("role のデフォルト値 (user) を UserRole にマッピングして返す", async () => {
      const created = await prisma.user.create({
        data: { email: "member@example.com", name: "Member" },
      })

      const result = await queryService.findById(created.id)

      expect(result?.role).toBe("user")
      expect(result?.displayName).toBeNull()
    })
  })

  describe("search", () => {
    it("ページ境界を適用し、全件数と決定的な並び順を返す", async () => {
      const sameTime = new Date("2026-03-01T00:00:00.000Z")
      await prisma.user.createMany({
        data: [
          {
            id: "u-b",
            email: "b@example.com",
            name: "B",
            createdAt: sameTime,
          },
          {
            id: "u-a",
            email: "a@example.com",
            name: "A",
            createdAt: sameTime,
          },
          {
            id: "u-c",
            email: "c@example.com",
            name: "C",
            createdAt: new Date("2026-03-02T00:00:00.000Z"),
          },
        ],
      })

      const result = await queryService.search({ limit: 1, offset: 1 })

      expect(result.total).toBe(3)
      expect(result.items.map((item) => item.id)).toEqual(["u-b"])
      expect(result.items[0]).toMatchObject({
        email: "b@example.com",
        role: "user",
        displayName: null,
        image: null,
        emailVerified: false,
      })
    })

    it.each([
      ["email", "needle.email@example.com", "Other", null],
      ["name", "other@example.com", "Needle Name", null],
      ["displayName", "other@example.com", "Other", "Needle Display"],
    ] as const)(
      "%s を大文字小文字を区別せず検索する",
      async (_field, email, name, displayName) => {
        await prisma.user.createMany({
          data: [
            { email, name, displayName },
            {
              email: "unmatched@example.com",
              name: "Unmatched",
              displayName: "Unmatched",
            },
          ],
        })

        const result = await queryService.search({
          limit: 20,
          offset: 0,
          search: "NEEDLE",
        })

        expect(result.total).toBe(1)
        expect(result.items.map((item) => item.email)).toEqual([email])
      }
    )

    it("role と search の両フィルタに一致する件数だけを total に返す", async () => {
      await prisma.user.createMany({
        data: [
          {
            email: "admin-match@example.com",
            name: "Match",
            role: "admin",
          },
          {
            email: "user-match@example.com",
            name: "Match",
            role: "user",
          },
          {
            email: "admin-other@example.com",
            name: "Other",
            role: "admin",
          },
        ],
      })

      const result = await queryService.search({
        limit: 20,
        offset: 0,
        search: "match",
        role: "admin",
      })

      expect(result.total).toBe(1)
      expect(result.items.map((item) => item.email)).toEqual([
        "admin-match@example.com",
      ])
    })

    it("一致するユーザーがいなければ空ページを返す", async () => {
      await prisma.user.create({
        data: { email: "member@example.com", name: "Member" },
      })

      await expect(
        queryService.search({
          limit: 20,
          offset: 0,
          search: "missing",
        })
      ).resolves.toEqual({ items: [], total: 0 })
    })
  })
})
