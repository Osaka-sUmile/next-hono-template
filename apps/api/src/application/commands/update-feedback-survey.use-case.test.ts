import { describe, expect, it, vi } from "vitest"
import {
  EmptyActiveFeedbackSurveyError,
  FeedbackQuestionEntity,
  FeedbackSurveyEntity,
  FeedbackSurveySlugConflictError,
} from "@workspace/domain"
import type { IFeedbackSurveyRepository } from "@workspace/domain"
import { FeedbackSurveyNotFoundError } from "../errors"
import { UpdateFeedbackSurveyUseCase } from "./update-feedback-survey.use-case"

function createSurvey(
  overrides: {
    slug?: string
    title?: string
    isActive?: boolean
    withQuestions?: boolean
  } = {}
): FeedbackSurveyEntity {
  const questions =
    overrides.withQuestions === false
      ? []
      : [
          FeedbackQuestionEntity.reconstitute(
            "question-1",
            "text",
            "一番の価値は何ですか？",
            false,
            0,
            []
          ),
        ]
  return FeedbackSurveyEntity.reconstitute(
    "survey-1",
    overrides.slug ?? "pmf-2026",
    overrides.title ?? "PMF アンケート",
    overrides.isActive ?? false,
    questions
  )
}

function createDeps(
  overrides: {
    findById?: ReturnType<typeof vi.fn>
    update?: ReturnType<typeof vi.fn>
    activateExclusively?: ReturnType<typeof vi.fn>
  } = {}
) {
  const findById =
    overrides.findById ?? vi.fn().mockResolvedValue(createSurvey())
  const update =
    overrides.update ??
    vi.fn().mockImplementation(async (entity: FeedbackSurveyEntity) => entity)
  const activateExclusively = overrides.activateExclusively ?? vi.fn()
  const repository = {
    findById,
    update,
    activateExclusively,
  } as unknown as IFeedbackSurveyRepository
  return { repository, findById, update, activateExclusively }
}

describe("UpdateFeedbackSurveyUseCase", () => {
  it("throws FeedbackSurveyNotFoundError without updating for an unknown id", async () => {
    const deps = createDeps({ findById: vi.fn().mockResolvedValue(null) })
    const useCase = new UpdateFeedbackSurveyUseCase(deps.repository)

    await expect(
      useCase.execute({ surveyId: "missing", title: "更新" })
    ).rejects.toBeInstanceOf(FeedbackSurveyNotFoundError)
    expect(deps.update).not.toHaveBeenCalled()
  })

  it("partially updates slug and title while preserving other fields and questions", async () => {
    const original = createSurvey()
    const deps = createDeps({
      findById: vi.fn().mockResolvedValue(original),
    })
    const useCase = new UpdateFeedbackSurveyUseCase(deps.repository)

    const result = await useCase.execute({
      surveyId: "survey-1",
      slug: "updated-slug",
      title: "更新後",
    })

    const saved = deps.update.mock.calls[0]?.[0] as FeedbackSurveyEntity
    expect(saved.slug).toBe("updated-slug")
    expect(saved.title).toBe("更新後")
    expect(saved.isActive).toBe(false)
    expect(saved.questions).toEqual(original.questions)
    expect(original.slug).toBe("pmf-2026")
    expect(original.title).toBe("PMF アンケート")
    expect(result.slug).toBe("updated-slug")
    expect(result.title).toBe("更新後")
  })

  it("updates an activated entity before exclusively activating the result", async () => {
    const calls: string[] = []
    let persisted: FeedbackSurveyEntity | undefined
    const update = vi
      .fn()
      .mockImplementation(async (entity: FeedbackSurveyEntity) => {
        calls.push("update")
        persisted = FeedbackSurveyEntity.reconstitute(
          "persisted-survey",
          entity.slug,
          entity.title,
          entity.isActive,
          entity.questions
        )
        return persisted
      })
    const activateExclusively = vi.fn().mockImplementation(async () => {
      calls.push("activateExclusively")
    })
    const deps = createDeps({ update, activateExclusively })
    const useCase = new UpdateFeedbackSurveyUseCase(deps.repository)

    const result = await useCase.execute({
      surveyId: "survey-1",
      isActive: true,
    })

    const inputToUpdate = update.mock.calls[0]?.[0] as FeedbackSurveyEntity
    expect(inputToUpdate.isActive).toBe(true)
    expect(calls).toEqual(["update", "activateExclusively"])
    expect(activateExclusively).toHaveBeenCalledWith(persisted)
    expect(result.id).toBe("persisted-survey")
    expect(result.isActive).toBe(true)
  })

  it("propagates an exclusive activation failure after updating", async () => {
    const calls: string[] = []
    const failure = new Error("activation failed")
    const update = vi
      .fn()
      .mockImplementation(async (entity: FeedbackSurveyEntity) => {
        calls.push("update")
        return entity
      })
    const activateExclusively = vi.fn().mockImplementation(async () => {
      calls.push("activateExclusively")
      throw failure
    })
    const deps = createDeps({ update, activateExclusively })
    const useCase = new UpdateFeedbackSurveyUseCase(deps.repository)

    await expect(
      useCase.execute({ surveyId: "survey-1", isActive: true })
    ).rejects.toBe(failure)
    expect(calls).toEqual(["update", "activateExclusively"])
  })

  it("does not exclusively activate when deactivating", async () => {
    const deps = createDeps({
      findById: vi.fn().mockResolvedValue(createSurvey({ isActive: true })),
    })
    const useCase = new UpdateFeedbackSurveyUseCase(deps.repository)

    const result = await useCase.execute({
      surveyId: "survey-1",
      isActive: false,
    })

    expect(
      (deps.update.mock.calls[0]?.[0] as FeedbackSurveyEntity).isActive
    ).toBe(false)
    expect(result.isActive).toBe(false)
    expect(deps.activateExclusively).not.toHaveBeenCalled()
  })

  it("does not exclusively activate when isActive is omitted", async () => {
    const deps = createDeps()
    const useCase = new UpdateFeedbackSurveyUseCase(deps.repository)

    await useCase.execute({ surveyId: "survey-1", title: "更新後" })

    expect(deps.activateExclusively).not.toHaveBeenCalled()
  })

  it("rejects activation of a survey without questions before any write", async () => {
    const deps = createDeps({
      findById: vi
        .fn()
        .mockResolvedValue(createSurvey({ withQuestions: false })),
    })
    const useCase = new UpdateFeedbackSurveyUseCase(deps.repository)

    await expect(
      useCase.execute({ surveyId: "survey-1", isActive: true })
    ).rejects.toBeInstanceOf(EmptyActiveFeedbackSurveyError)
    expect(deps.update).not.toHaveBeenCalled()
    expect(deps.activateExclusively).not.toHaveBeenCalled()
  })

  it("does not stop other surveys when updating fails with a slug conflict", async () => {
    const conflict = new FeedbackSurveySlugConflictError("duplicate")
    const deps = createDeps({ update: vi.fn().mockRejectedValue(conflict) })
    const useCase = new UpdateFeedbackSurveyUseCase(deps.repository)

    await expect(
      useCase.execute({
        surveyId: "survey-1",
        slug: "duplicate",
        isActive: true,
      })
    ).rejects.toBe(conflict)
    expect(deps.activateExclusively).not.toHaveBeenCalled()
  })

  it("throws not found when a concurrent delete wins before update", async () => {
    const deps = createDeps({ update: vi.fn().mockResolvedValue(null) })
    const useCase = new UpdateFeedbackSurveyUseCase(deps.repository)

    await expect(
      useCase.execute({ surveyId: "survey-1", title: "更新後" })
    ).rejects.toBeInstanceOf(FeedbackSurveyNotFoundError)
  })
})
