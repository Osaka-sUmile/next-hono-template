import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import type { PrismaClient } from "@prisma/client"
import { createTestPrismaClient, resetDatabase } from "../test-utils"
import { AdminQueryService } from "./admin.query-service"

describe("AdminQueryService (integration)", () => {
  let prisma: PrismaClient
  let queryService: AdminQueryService

  beforeAll(() => {
    prisma = createTestPrismaClient()
    queryService = new AdminQueryService(prisma)
  })

  beforeEach(async () => {
    await resetDatabase(prisma)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it("データがない場合はすべての KPI を 0 で返す", async () => {
    await expect(queryService.summarize()).resolves.toEqual({
      userCount: 0,
      adminCount: 0,
      surveyCount: 0,
      activeSurveyCount: 0,
      submissionCount: 0,
      submissionCountLast7Days: 0,
    })
  })

  it("role と公開状態が混在していても各件数を正しく返す", async () => {
    await prisma.user.createMany({
      data: [
        {
          id: "admin-1",
          email: "admin1@example.com",
          name: "Admin 1",
          role: "admin",
        },
        {
          id: "admin-2",
          email: "admin2@example.com",
          name: "Admin 2",
          role: "admin",
        },
        {
          id: "user-1",
          email: "user1@example.com",
          name: "User 1",
          role: "user",
        },
      ],
    })
    await prisma.feedbackSurvey.createMany({
      data: [
        {
          id: "survey-active",
          slug: "active",
          title: "公開中",
          isActive: true,
        },
        { id: "survey-draft-1", slug: "draft-1", title: "下書き1" },
        { id: "survey-draft-2", slug: "draft-2", title: "下書き2" },
      ],
    })
    await prisma.feedbackSubmission.createMany({
      data: [
        {
          id: "submission-1",
          surveyId: "survey-active",
          userId: "user-1",
        },
        {
          id: "submission-2",
          surveyId: "survey-draft-1",
          userId: "admin-1",
        },
      ],
    })

    await expect(queryService.summarize()).resolves.toMatchObject({
      userCount: 3,
      adminCount: 2,
      surveyCount: 3,
      activeSurveyCount: 1,
      submissionCount: 2,
    })
  })

  it("直近 7 日は境界時刻を含み、その直前の提出を含めない", async () => {
    const now = new Date("2026-07-30T12:00:00.000Z")
    const boundary = new Date("2026-07-23T12:00:00.000Z")
    vi.spyOn(Date, "now").mockReturnValue(now.getTime())

    await prisma.user.create({
      data: { id: "user-1", email: "user@example.com", name: "User" },
    })
    await prisma.feedbackSurvey.create({
      data: { id: "survey-1", slug: "survey-1", title: "アンケート" },
    })
    await prisma.feedbackSubmission.createMany({
      data: [
        {
          id: "submission-at-boundary",
          surveyId: "survey-1",
          userId: "user-1",
          createdAt: boundary,
        },
        {
          id: "submission-inside",
          surveyId: "survey-1",
          userId: "user-1",
          createdAt: new Date(boundary.getTime() + 1),
        },
        {
          id: "submission-before-boundary",
          surveyId: "survey-1",
          userId: "user-1",
          createdAt: new Date(boundary.getTime() - 1),
        },
      ],
    })

    await expect(queryService.summarize()).resolves.toMatchObject({
      submissionCount: 3,
      submissionCountLast7Days: 2,
    })
  })
})
