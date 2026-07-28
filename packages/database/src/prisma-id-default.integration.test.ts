import { readFileSync } from "node:fs";
import { join } from "node:path";
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

// 採番される値そのものは Prisma クライアント共通の仕組みなので、上の 2 モデルで振る舞いを
// 押さえれば足りる。モデルごとに変わるのは「注釈が付いているか」だけなので、そこは
// スキーマ全体を走査して担保する (モデルを増やしたときの付け忘れもここで落ちる)。
// DB を使わない検証だが、vitest の include が *.integration.test.ts に限定されているため
// このファイルに同居させる。
describe("schema.prisma の ID 注釈", () => {
  // vitest の root はこのパッケージ (vitest.config.ts の位置) なので cwd 基準で解決する。
  // import.meta は CJS ビルド対象のため使えない。
  const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
  // 方針コメント自身が `@db.Uuid` 等に言及するため、宣言だけを見るようコメント行を落とす。
  const declarations = schema
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line));

  it("主キーの既定値がすべて uuid(4) になっている", () => {
    const idLines = declarations.filter((line) => /^\s*id\s+String\s+@id/.test(line));

    expect(idLines.length).toBeGreaterThan(0);
    const notUuidV4 = idLines.filter((line) => !line.includes("@default(uuid(4))"));
    expect(notUuidV4).toEqual([]);
  });

  it("非推奨の cuid が残っていない", () => {
    expect(declarations.filter((line) => /@default\(cuid\(/.test(line))).toEqual([]);
  });

  it("@db.Uuid を使っていない (seed の可読 ID と両立させるため)", () => {
    expect(declarations.filter((line) => /@db\.Uuid/.test(line))).toEqual([]);
  });
});
