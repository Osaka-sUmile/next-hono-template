import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { FeedbackSubmissionEntity } from "@workspace/domain";
import { FeedbackSubmissionPrismaRepository } from "./feedback-submission.prisma-repository";
import { createTestPrismaClient, resetDatabase } from "../test-utils";

describe("FeedbackSubmissionPrismaRepository (integration)", () => {
  let prisma: PrismaClient;
  let repository: FeedbackSubmissionPrismaRepository;

  beforeAll(() => {
    prisma = createTestPrismaClient();
    repository = new FeedbackSubmissionPrismaRepository(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await prisma.user.create({
      data: {
        id: "user-1",
        email: "feedback@example.com",
        name: "Feedback User",
      },
    });
    await prisma.feedbackSurvey.create({
      data: {
        id: "survey-1",
        slug: "survey-1",
        title: "アンケート",
        isActive: true,
        questions: {
          create: [
            {
              id: "question-choice",
              type: "single_choice",
              text: "選択式",
              required: true,
              sortOrder: 1,
              choices: {
                create: [
                  {
                    id: "choice-yes",
                    value: "yes",
                    label: "はい",
                    sortOrder: 1,
                  },
                ],
              },
            },
            {
              id: "question-text",
              type: "text",
              text: "自由記述",
              required: false,
              sortOrder: 2,
            },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("save した提出を findById で回答を含めて復元できる", async () => {
    const createdAt = new Date("2026-07-26T01:00:00.000Z");
    const entity = FeedbackSubmissionEntity.reconstitute(
      "submission-1",
      "survey-1",
      "user-1",
      [
        {
          questionId: "question-choice",
          choiceId: "choice-yes",
          textValue: null,
        },
        {
          questionId: "question-text",
          choiceId: null,
          textValue: "回答本文",
        },
      ],
      createdAt
    );

    const saved = await repository.save(entity);
    const found = await repository.findById("submission-1");

    expect(saved.id).toBe("submission-1");
    expect(found?.id).toBe("submission-1");
    expect(found?.surveyId).toBe("survey-1");
    expect(found?.userId).toBe("user-1");
    expect(found?.createdAt).toEqual(createdAt);
    expect(found?.answers).toEqual([
      {
        questionId: "question-choice",
        choiceId: "choice-yes",
        textValue: null,
      },
      {
        questionId: "question-text",
        choiceId: null,
        textValue: "回答本文",
      },
    ]);
  });

  it("存在しない id の findById は null を返す", async () => {
    await expect(repository.findById("missing")).resolves.toBeNull();
  });

  it("既存提出への save は回答を置き換える", async () => {
    const createdAt = new Date("2026-07-26T01:00:00.000Z");
    const changedCreatedAt = new Date("2026-07-27T01:00:00.000Z");
    await repository.save(
      FeedbackSubmissionEntity.reconstitute(
        "submission-update",
        "survey-1",
        "user-1",
        [
          {
            questionId: "question-text",
            choiceId: null,
            textValue: "更新前",
          },
        ],
        createdAt
      )
    );

    await repository.save(
      FeedbackSubmissionEntity.reconstitute(
        "submission-update",
        "survey-1",
        "user-1",
        [
          {
            questionId: "question-text",
            choiceId: null,
            textValue: "更新後",
          },
        ],
        changedCreatedAt
      )
    );

    const found = await repository.findById("submission-update");

    expect(found?.createdAt).toEqual(createdAt);
    expect(found?.answers).toEqual([
      {
        questionId: "question-text",
        choiceId: null,
        textValue: "更新後",
      },
    ]);
    await expect(prisma.feedbackAnswer.count()).resolves.toBe(1);
  });

  it("delete で提出と回答を削除する", async () => {
    const entity = FeedbackSubmissionEntity.reconstitute(
      "submission-delete",
      "survey-1",
      "user-1",
      [
        {
          questionId: "question-choice",
          choiceId: "choice-yes",
          textValue: null,
        },
      ],
      new Date("2026-07-26T01:00:00.000Z")
    );
    await repository.save(entity);

    await repository.delete(entity);

    await expect(repository.findById("submission-delete")).resolves.toBeNull();
    await expect(prisma.feedbackAnswer.count()).resolves.toBe(0);
  });

  it("同一提出に同じ questionId の回答を2件 save すると P2002 で失敗する", async () => {
    const duplicate = FeedbackSubmissionEntity.reconstitute(
      "submission-duplicate",
      "survey-1",
      "user-1",
      [
        {
          questionId: "question-choice",
          choiceId: "choice-yes",
          textValue: null,
        },
        {
          questionId: "question-choice",
          choiceId: "choice-yes",
          textValue: null,
        },
      ],
      new Date("2026-07-26T01:00:00.000Z")
    );

    await expect(repository.save(duplicate)).rejects.toMatchObject({
      code: "P2002",
    });
    await expect(
      repository.findById("submission-duplicate")
    ).resolves.toBeNull();
  });
});
