import { describe, expect, it, vi } from "vitest"
import type {
  FeedbackSummaryTallyResult,
  IFeedbackQueryService,
} from "@workspace/domain"
import { SummarizeFeedbackUseCase } from "./summarize-feedback.use-case"

function createQueryService(
  overrides: Partial<IFeedbackQueryService> = {}
): IFeedbackQueryService {
  return {
    findActiveSurveyView: vi.fn(),
    listSubmissions: vi.fn(),
    summarize: vi.fn(),
    ...overrides,
  }
}

const tallyResult: FeedbackSummaryTallyResult = {
  respondentCount: 2,
  tallies: [
    { questionId: "q-1", choiceValue: "very_disappointed", count: 2 },
    { questionId: "q-1", choiceValue: "somewhat_disappointed", count: 0 },
  ],
}

describe("SummarizeFeedbackUseCase", () => {
  it("summarizes the given survey and returns the surveyId with the tallies", async () => {
    const summarize = vi.fn().mockResolvedValue(tallyResult)
    const useCase = new SummarizeFeedbackUseCase(
      createQueryService({ summarize })
    )

    const result = await useCase.execute({ surveyId: "survey-1" })

    expect(summarize).toHaveBeenCalledWith("survey-1")
    expect(result).toEqual({
      surveyId: "survey-1",
      respondentCount: 2,
      tallies: tallyResult.tallies,
    })
  })

  it("returns an empty summary when the survey has no submissions", async () => {
    const useCase = new SummarizeFeedbackUseCase(
      createQueryService({
        summarize: vi
          .fn()
          .mockResolvedValue({ respondentCount: 0, tallies: [] }),
      })
    )

    const result = await useCase.execute({ surveyId: "survey-9" })

    expect(result).toEqual({
      surveyId: "survey-9",
      respondentCount: 0,
      tallies: [],
    })
  })
})
