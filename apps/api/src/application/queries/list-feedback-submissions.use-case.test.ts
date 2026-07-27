import { describe, expect, it, vi } from "vitest";
import type {
  FeedbackSubmissionListResult,
  IFeedbackQueryService,
} from "@workspace/domain";
import { ListFeedbackSubmissionsUseCase } from "./list-feedback-submissions.use-case";

function createQueryService(overrides: Partial<IFeedbackQueryService> = {}): IFeedbackQueryService {
  return {
    findActiveSurveyView: vi.fn(),
    listSubmissions: vi.fn(),
    summarize: vi.fn(),
    ...overrides,
  };
}

const listResult: FeedbackSubmissionListResult = {
  total: 3,
  items: [
    {
      id: "submission-1",
      surveyId: "survey-1",
      user: {
        id: "user-1",
        email: "user@example.com",
        name: "User",
        displayName: null,
      },
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      answers: [
        {
          questionId: "q-1",
          questionText: "使えなくなったらどう思いますか？",
          choiceValue: "very_disappointed",
          choiceLabel: "非常に残念",
          textValue: null,
        },
      ],
    },
  ],
};

describe("ListFeedbackSubmissionsUseCase", () => {
  it("passes paging params through and echoes them back with the result", async () => {
    const listSubmissions = vi.fn().mockResolvedValue(listResult);
    const useCase = new ListFeedbackSubmissionsUseCase(createQueryService({ listSubmissions }));

    const result = await useCase.execute({ limit: 20, offset: 40, surveyId: "survey-1" });

    expect(listSubmissions).toHaveBeenCalledWith({ limit: 20, offset: 40, surveyId: "survey-1" });
    expect(result).toEqual({
      items: listResult.items,
      total: 3,
      limit: 20,
      offset: 40,
    });
  });

  it("omits surveyId when it is not given so every survey is included", async () => {
    const listSubmissions = vi.fn().mockResolvedValue({ items: [], total: 0 });
    const useCase = new ListFeedbackSubmissionsUseCase(createQueryService({ listSubmissions }));

    const result = await useCase.execute({ limit: 10, offset: 0 });

    expect(listSubmissions).toHaveBeenCalledWith({ limit: 10, offset: 0 });
    expect(result).toEqual({ items: [], total: 0, limit: 10, offset: 0 });
  });
});
