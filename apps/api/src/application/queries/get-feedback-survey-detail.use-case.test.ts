import { describe, expect, it, vi } from "vitest"
import type {
  FeedbackSurveyDetailView,
  IFeedbackQueryService,
} from "@workspace/domain"
import { FeedbackSurveyNotFoundError } from "../errors"
import { GetFeedbackSurveyDetailUseCase } from "./get-feedback-survey-detail.use-case"

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

const detailView: FeedbackSurveyDetailView = {
  id: "survey-1",
  slug: "pmf-2026",
  title: "PMF アンケート",
  isActive: false,
  createdAt: new Date("2026-07-26T00:00:00.000Z"),
  questions: [
    {
      id: "q-1",
      type: "single_choice",
      text: "使えなくなったらどう思いますか？",
      required: true,
      sortOrder: 1,
      choices: [
        { value: "very_disappointed", label: "非常に残念", sortOrder: 1 },
      ],
    },
  ],
}

describe("GetFeedbackSurveyDetailUseCase", () => {
  it("設問・選択肢と公開状態を含む DTO を返す", async () => {
    const findSurveyDetailById = vi.fn().mockResolvedValue(detailView)
    const useCase = new GetFeedbackSurveyDetailUseCase(
      createQueryService({ findSurveyDetailById })
    )

    const result = await useCase.execute({ surveyId: "survey-1" })

    expect(findSurveyDetailById).toHaveBeenCalledWith("survey-1")
    expect(result).toEqual(detailView)
  })

  // null をそのまま返すと Presentation 層が 404 と 200 を区別できないため、
  // ApplicationError への変換をここで固定する。
  it("該当アンケートが無い場合は FeedbackSurveyNotFoundError を投げる", async () => {
    const useCase = new GetFeedbackSurveyDetailUseCase(
      createQueryService({
        findSurveyDetailById: vi.fn().mockResolvedValue(null),
      })
    )

    await expect(useCase.execute({ surveyId: "survey-9" })).rejects.toThrow(
      FeedbackSurveyNotFoundError
    )
  })
})
