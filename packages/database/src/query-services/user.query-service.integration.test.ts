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
});
