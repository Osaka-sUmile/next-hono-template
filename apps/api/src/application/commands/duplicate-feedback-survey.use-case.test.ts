import { describe, expect, it, vi } from "vitest"
import {
  FeedbackChoice,
  FeedbackQuestionEntity,
  FeedbackSurveyEntity,
} from "@workspace/domain"
import type { IFeedbackSurveyRepository, IIdGenerator } from "@workspace/domain"
import { FeedbackSurveyNotFoundError } from "../errors"
import { DuplicateFeedbackSurveyUseCase } from "./duplicate-feedback-survey.use-case"

function sourceSurvey() {
  return FeedbackSurveyEntity.reconstitute(
    "source",
    "source-slug",
    "元アンケート",
    true,
    [
      FeedbackQuestionEntity.reconstitute(
        "source-question",
        "single_choice",
        "元設問",
        true,
        0,
        [FeedbackChoice.reconstitute("source-choice", "yes", "はい", 0)]
      ),
    ]
  )
}

describe("DuplicateFeedbackSurveyUseCase", () => {
  it("copies questions with new ids into an inactive survey", async () => {
    const save = vi
      .fn()
      .mockImplementation(async (entity: FeedbackSurveyEntity) => entity)
    const repository = {
      findById: vi.fn().mockResolvedValue(sourceSurvey()),
      save,
    } as unknown as IFeedbackSurveyRepository
    const idGenerator = {
      generate: vi
        .fn()
        .mockReturnValueOnce("duplicate")
        .mockReturnValueOnce("duplicate-question")
        .mockReturnValueOnce("duplicate-choice"),
    } as unknown as IIdGenerator
    const useCase = new DuplicateFeedbackSurveyUseCase(repository, idGenerator)

    const result = await useCase.execute({
      surveyId: "source",
      slug: "copied",
      title: "複製アンケート",
    })

    expect(result).toMatchObject({
      id: "duplicate",
      slug: "copied",
      title: "複製アンケート",
      isActive: false,
    })
    expect(result.questions[0]).toMatchObject({
      id: "duplicate-question",
      text: "元設問",
      choices: [{ value: "yes", label: "はい", sortOrder: 0 }],
    })
  })

  it("throws not found without saving for an unknown source", async () => {
    const save = vi.fn()
    const repository = {
      findById: vi.fn().mockResolvedValue(null),
      save,
    } as unknown as IFeedbackSurveyRepository
    const useCase = new DuplicateFeedbackSurveyUseCase(repository, {
      generate: vi.fn(),
    })

    await expect(
      useCase.execute({
        surveyId: "missing",
        slug: "copied",
        title: "複製",
      })
    ).rejects.toBeInstanceOf(FeedbackSurveyNotFoundError)
    expect(save).not.toHaveBeenCalled()
  })
})
