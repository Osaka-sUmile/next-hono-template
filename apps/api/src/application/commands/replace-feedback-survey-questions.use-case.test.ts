import { describe, expect, it, vi } from "vitest"
import {
  FeedbackQuestionEntity,
  FeedbackSurveyEntity,
  FeedbackSurveyMustBeInactiveError,
} from "@workspace/domain"
import type { IFeedbackSurveyRepository, IIdGenerator } from "@workspace/domain"
import { FeedbackSurveyNotFoundError } from "../errors"
import { ReplaceFeedbackSurveyQuestionsUseCase } from "./replace-feedback-survey-questions.use-case"

function survey(isActive = false) {
  return FeedbackSurveyEntity.reconstitute(
    "survey-1",
    "draft",
    "下書き",
    isActive,
    [
      FeedbackQuestionEntity.reconstitute(
        "old-question",
        "text",
        "旧設問",
        false,
        0,
        []
      ),
    ]
  )
}

function deps(current: FeedbackSurveyEntity | null = survey()) {
  const findById = vi.fn().mockResolvedValue(current)
  const replaceQuestions = vi
    .fn()
    .mockImplementation(async (entity: FeedbackSurveyEntity) => entity)
  return {
    repository: {
      findById,
      replaceQuestions,
    } as unknown as IFeedbackSurveyRepository,
    idGenerator: {
      generate: vi
        .fn()
        .mockReturnValueOnce("new-question")
        .mockReturnValueOnce("new-choice"),
    } as unknown as IIdGenerator,
    findById,
    replaceQuestions,
  }
}

describe("ReplaceFeedbackSurveyQuestionsUseCase", () => {
  it("generates new ids and replaces the complete question set", async () => {
    const d = deps()
    const useCase = new ReplaceFeedbackSurveyQuestionsUseCase(
      d.repository,
      d.idGenerator
    )

    const result = await useCase.execute({
      surveyId: "survey-1",
      questions: [
        {
          type: "single_choice",
          text: "新設問",
          required: true,
          choices: [{ value: "yes", label: "はい" }],
        },
      ],
    })

    const replacement = d.replaceQuestions.mock
      .calls[0]?.[0] as FeedbackSurveyEntity
    expect(replacement.questions[0]?.id).toBe("new-question")
    expect(replacement.questions[0]?.choices[0]?.id).toBe("new-choice")
    expect(result.questions[0]?.text).toBe("新設問")
  })

  it("rejects an active survey before calling the repository mutation", async () => {
    const d = deps(survey(true))
    const useCase = new ReplaceFeedbackSurveyQuestionsUseCase(
      d.repository,
      d.idGenerator
    )

    await expect(
      useCase.execute({ surveyId: "survey-1", questions: [] })
    ).rejects.toBeInstanceOf(FeedbackSurveyMustBeInactiveError)
    expect(d.replaceQuestions).not.toHaveBeenCalled()
  })

  it("throws not found when the survey does not exist", async () => {
    const d = deps(null)
    const useCase = new ReplaceFeedbackSurveyQuestionsUseCase(
      d.repository,
      d.idGenerator
    )

    await expect(
      useCase.execute({ surveyId: "missing", questions: [] })
    ).rejects.toBeInstanceOf(FeedbackSurveyNotFoundError)
  })
})
