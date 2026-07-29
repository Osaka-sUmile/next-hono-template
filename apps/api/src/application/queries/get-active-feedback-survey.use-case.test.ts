import { describe, expect, it, vi } from "vitest"
import type {
  FeedbackSurveyView,
  IFeedbackQueryService,
} from "@workspace/domain"
import { ActiveFeedbackSurveyNotFoundError } from "../errors"
import { GetActiveFeedbackSurveyUseCase } from "./get-active-feedback-survey.use-case"

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

const surveyView: FeedbackSurveyView = {
  id: "survey-1",
  slug: "pmf-2026",
  title: "PMF アンケート",
  questions: [
    {
      id: "q-1",
      type: "single_choice",
      text: "使えなくなったらどう思いますか？",
      required: true,
      sortOrder: 0,
      choices: [
        { value: "very_disappointed", label: "非常に残念", sortOrder: 0 },
      ],
    },
    {
      id: "q-2",
      type: "text",
      text: "一番の価値は？",
      required: false,
      sortOrder: 1,
      choices: [],
    },
  ],
}

describe("GetActiveFeedbackSurveyUseCase", () => {
  it("returns the active survey as a response DTO", async () => {
    const findActiveSurveyView = vi.fn().mockResolvedValue(surveyView)
    const useCase = new GetActiveFeedbackSurveyUseCase(
      createQueryService({ findActiveSurveyView })
    )

    const result = await useCase.execute()

    expect(findActiveSurveyView).toHaveBeenCalledOnce()
    expect(result).toEqual(surveyView)
  })

  it("throws ActiveFeedbackSurveyNotFoundError when no survey is active", async () => {
    const useCase = new GetActiveFeedbackSurveyUseCase(
      createQueryService({
        findActiveSurveyView: vi.fn().mockResolvedValue(null),
      })
    )

    await expect(useCase.execute()).rejects.toBeInstanceOf(
      ActiveFeedbackSurveyNotFoundError
    )
  })
})
