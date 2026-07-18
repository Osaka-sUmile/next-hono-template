import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { UserQueryService } from "./user.query-service";
import { createTestPrismaClient, resetDatabase } from "../test-utils";

// 読み取り専用の query-service を実 DB に対して検証する。
// 前提データは prisma で直接投入し、期待する DTO の形と値・空結果・境界値を確認する。
// 書き込み経路 (save→findById 往復) は repository 側のテストが担うため、ここでは要求しない。
describe("UserQueryService (integration)", () => {
  let prisma: PrismaClient;
  let queryService: UserQueryService;

  // 接続リークを避けるため PrismaClient は一度だけ生成し、各テストの独立性は
  // beforeEach の resetDatabase (truncate) で担保する。
  beforeAll(() => {
    prisma = createTestPrismaClient();
    queryService = new UserQueryService(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

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
      });

      const result = await queryService.findById(created.id);

      expect(result).toEqual({
        id: created.id,
        email: "admin@example.com",
        name: "Admin User",
        role: "admin",
        displayName: "Boss",
        image: null,
        emailVerified: true,
        createdAt: created.createdAt,
      });
    });

    it("存在しない id の場合は null を返す", async () => {
      await expect(queryService.findById("missing-id")).resolves.toBeNull();
    });

    it("role のデフォルト値 (user) を UserRole にマッピングして返す", async () => {
      const created = await prisma.user.create({
        data: { email: "member@example.com", name: "Member" },
      });

      const result = await queryService.findById(created.id);

      expect(result?.role).toBe("user");
      expect(result?.displayName).toBeNull();
    });
  });

  describe("findAll", () => {
    it("複数ユーザーを createdAt 昇順で、読み取り専用 DTO の配列にして返す", async () => {
      // 並び順を決定的にするため createdAt を明示する (同一時刻だと DB は順序を保証しないため)。
      const admin = await prisma.user.create({
        data: {
          email: "admin@example.com",
          name: "Admin User",
          role: "admin",
          displayName: "Boss",
          emailVerified: true,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      });
      const member = await prisma.user.create({
        data: {
          email: "member@example.com",
          name: "Member User",
          role: "user",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
        },
      });

      const results = await queryService.findAll();

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.email)).toEqual(["admin@example.com", "member@example.com"]);
      expect(results[0]).toEqual({
        id: admin.id,
        email: "admin@example.com",
        name: "Admin User",
        role: "admin",
        displayName: "Boss",
        image: null,
        emailVerified: true,
        createdAt: admin.createdAt,
      });
      expect(results[1]).toEqual({
        id: member.id,
        email: "member@example.com",
        name: "Member User",
        role: "user",
        displayName: null,
        image: null,
        emailVerified: false,
        createdAt: member.createdAt,
      });
    });

    it("createdAt が同一のユーザーは id 昇順で決定的に並ぶ", async () => {
      const sameTime = new Date("2026-03-01T00:00:00.000Z");
      // id 昇順が投入順と逆になるよう、先に id="u-b" を投入する。
      await prisma.user.create({
        data: { id: "u-b", email: "b@example.com", name: "B", createdAt: sameTime },
      });
      await prisma.user.create({
        data: { id: "u-a", email: "a@example.com", name: "A", createdAt: sameTime },
      });

      const results = await queryService.findAll();

      // 投入順ではなく id 昇順 (tie-breaker) で並ぶこと。
      expect(results.map((r) => r.id)).toEqual(["u-a", "u-b"]);
    });

    it("ユーザーが存在しない場合は空配列を返す", async () => {
      await expect(queryService.findAll()).resolves.toEqual([]);
    });

    it("role のデフォルト値 (user) を含めて正しくマッピングする", async () => {
      await prisma.user.create({
        data: { email: "member@example.com", name: "Member" },
      });

      const results = await queryService.findAll();

      expect(results[0]?.role).toBe("user");
      expect(results[0]?.displayName).toBeNull();
    });
  });
});
