import { describe, expect, it, vi } from "vitest"
import { FeedbackSurveyEntity } from "@workspace/domain"
import type { IFeedbackSurveyRepository } from "@workspace/domain"
import { FeedbackSurveyNotFoundError } from "../errors"
import { DeleteFeedbackSurveyUseCase } from "./delete-feedback-survey.use-case"

describe("DeleteFeedbackSurveyUseCase", () => {
  it("delegates guarded deletion to the repository", async () => {
    const survey = FeedbackSurveyEntity.create({
      id: "survey-1",
      slug: "draft",
      title: "下書き",
      isActive: false,
      questions: [],
    })
    const deleteSurvey = vi.fn()
    const repository = {
      findById: vi.fn().mockResolvedValue(survey),
      delete: deleteSurvey,
    } as unknown as IFeedbackSurveyRepository

    await new DeleteFeedbackSurveyUseCase(repository).execute({
      surveyId: "survey-1",
    })

    expect(deleteSurvey).toHaveBeenCalledWith(survey)
  })

  it("throws not found without deleting an unknown survey", async () => {
    const deleteSurvey = vi.fn()
    const repository = {
      findById: vi.fn().mockResolvedValue(null),
      delete: deleteSurvey,
    } as unknown as IFeedbackSurveyRepository

    await expect(
      new DeleteFeedbackSurveyUseCase(repository).execute({
        surveyId: "missing",
      })
    ).rejects.toBeInstanceOf(FeedbackSurveyNotFoundError)
    expect(deleteSurvey).not.toHaveBeenCalled()
  })
})
