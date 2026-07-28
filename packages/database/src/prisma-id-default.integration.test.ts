import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createTestPrismaClient, resetDatabase } from "./test-utils";

// schema.prisma の `@default(uuid(4))` は SQL の DEFAULT 句にならず Prisma クライアントが
// INSERT 直前に採番するため、実際に生成される値は実 DB 経由でしか確認できない。
// ID 方式を変えたときに全モデルへ反映漏れがないかを、採番元の異なる 2 モデルで押さえる。
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("Prisma の ID 既定採番 (integration)", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = createTestPrismaClient();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("id を省略した User に UUIDv4 を採番する", async () => {
    const user = await prisma.user.create({
      data: { email: "id-default@example.com", name: "ID Default" },
    });

    expect(user.id).toMatch(UUID_V4_PATTERN);
  });

  it("id を省略した FeedbackSurvey に UUIDv4 を採番する", async () => {
    const survey = await prisma.feedbackSurvey.create({
      data: { slug: "id-default-survey", title: "ID 既定採番の確認" },
    });

    expect(survey.id).toMatch(UUID_V4_PATTERN);
  });

  it("id を明示した場合は採番せずその値を使う (seed の可読 ID を壊さない)", async () => {
    const survey = await prisma.feedbackSurvey.create({
      data: { id: "feedback-survey-readable-id", slug: "readable", title: "可読 ID" },
    });

    expect(survey.id).toBe("feedback-survey-readable-id");
  });
});
