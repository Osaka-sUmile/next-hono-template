import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { InvalidArgumentError } from "@workspace/domain";
import { FeedbackSurveyPrismaRepository } from "./feedback-survey.prisma-repository";
import { createTestPrismaClient, resetDatabase } from "../test-utils";

describe("FeedbackSurveyPrismaRepository (integration)", () => {
  let prisma: PrismaClient;
  let repository: FeedbackSurveyPrismaRepository;

  beforeAll(() => {
    prisma = createTestPrismaClient();
    repository = new FeedbackSurveyPrismaRepository(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("公開中アンケートを設問・選択肢の sortOrder 順で復元する", async () => {
    await prisma.feedbackSurvey.create({
      data: {
        id: "inactive-survey",
        slug: "inactive",
        title: "非公開",
        isActive: false,
      },
    });
    await prisma.feedbackSurvey.create({
      data: {
        id: "active-survey",
        slug: "active",
        title: "公開中",
        isActive: true,
        questions: {
          create: [
            {
              id: "question-2",
              type: "text",
              text: "自由記述",
              required: false,
              sortOrder: 2,
            },
            {
              id: "question-1",
              type: "single_choice",
              text: "選択式",
              required: true,
              sortOrder: 1,
              choices: {
                create: [
                  {
                    id: "choice-2",
                    value: "no",
                    label: "いいえ",
                    sortOrder: 2,
                  },
                  { id: "choice-1", value: "yes", label: "はい", sortOrder: 1 },
                ],
              },
            },
          ],
        },
      },
    });

    const survey = await repository.findActive();

    expect(survey?.id).toBe("active-survey");
    expect(survey?.slug).toBe("active");
    expect(survey?.title).toBe("公開中");
    expect(survey?.isActive).toBe(true);
    expect(survey?.questions.map((question) => question.id)).toEqual([
      "question-1",
      "question-2",
    ]);
    expect(survey?.questions[0]?.type).toBe("single_choice");
    expect(survey?.questions[0]?.required).toBe(true);
    expect(survey?.questions[0]?.choices.map((choice) => choice.id)).toEqual([
      "choice-1",
      "choice-2",
    ]);
  });

  it("公開中アンケートが存在しない場合は null を返す", async () => {
    await prisma.feedbackSurvey.create({
      data: {
        id: "inactive-survey",
        slug: "inactive",
        title: "非公開",
        isActive: false,
      },
    });

    await expect(repository.findActive()).resolves.toBeNull();
  });

  it("不正なアンケートを復元できない場合は cause 付きの文脈エラーを返す", async () => {
    await prisma.feedbackSurvey.create({
      data: {
        id: "invalid-survey",
        slug: "invalid",
        title: "",
        isActive: true,
      },
    });

    await expect(repository.findActive()).rejects.toMatchObject({
      message:
        "Failed to reconstitute FeedbackSurveyEntity (id=invalid-survey)",
      cause: expect.any(InvalidArgumentError),
    });
  });
});
