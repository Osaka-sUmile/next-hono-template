import { describe, expect, it, vi } from "vitest"
import type {
  FeedbackSurveyListItemView,
  IFeedbackQueryService,
} from "@workspace/domain"
import { ListFeedbackSurveysUseCase } from "./list-feedback-surveys.use-case"

function createQueryService(
  overrides: Partial<IFeedbackQueryService> = {}
): IFeedbackQueryService {
  return {
    findActiveSurveyView: vi.fn(),
    listSurveys: vi.fn(),
    findSurveyDetailById: vi.fn(),
    listSubmissions: vi.fn(),
    summarize: vi.fn(),
    ...overrides,
  }
}

const surveyView: FeedbackSurveyListItemView = {
  id: "survey-1",
  slug: "pmf-2026",
  title: "PMF アンケート",
  isActive: true,
  questionCount: 4,
  submissionCount: 12,
  createdAt: new Date("2026-07-26T00:00:00.000Z"),
}

describe("ListFeedbackSurveysUseCase", () => {
  it("QueryService の一覧を envelope に包んで返す", async () => {
    const listSurveys = vi.fn().mockResolvedValue([surveyView])
    const useCase = new ListFeedbackSurveysUseCase(
      createQueryService({ listSurveys })
    )

    const result = await useCase.execute()

    expect(listSurveys).toHaveBeenCalledOnce()
    expect(result).toEqual({ items: [surveyView] })
  })

  it("アンケートが存在しない場合は空の items を返す", async () => {
    const useCase = new ListFeedbackSurveysUseCase(
      createQueryService({ listSurveys: vi.fn().mockResolvedValue([]) })
    )

    await expect(useCase.execute()).resolves.toEqual({ items: [] })
  })
})
