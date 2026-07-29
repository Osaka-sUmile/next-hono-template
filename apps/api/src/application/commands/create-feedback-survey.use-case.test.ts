import { describe, expect, it, vi } from "vitest"
import {
  EmptyActiveFeedbackSurveyError,
  FeedbackSurveyEntity,
  FeedbackSurveySlugConflictError,
} from "@workspace/domain"
import type { IFeedbackSurveyRepository, IIdGenerator } from "@workspace/domain"
import { CreateFeedbackSurveyUseCase } from "./create-feedback-survey.use-case"

function createDeps(
  overrides: {
    save?: ReturnType<typeof vi.fn>
    activateExclusively?: ReturnType<typeof vi.fn>
    generate?: ReturnType<typeof vi.fn>
  } = {}
) {
  const save =
    overrides.save ??
    vi.fn().mockImplementation(async (entity: FeedbackSurveyEntity) => entity)
  const activateExclusively = overrides.activateExclusively ?? vi.fn()
  const generate =
    overrides.generate ??
    vi
      .fn()
      .mockReturnValueOnce("survey-1")
      .mockReturnValueOnce("question-1")
      .mockReturnValueOnce("choice-1")
      .mockReturnValueOnce("choice-2")
      .mockReturnValueOnce("question-2")

  const repository = {
    save,
    activateExclusively,
  } as unknown as IFeedbackSurveyRepository
  const idGenerator = { generate } as unknown as IIdGenerator

  return { repository, idGenerator, save, activateExclusively, generate }
}

const surveyInput = {
  slug: "pmf-2026",
  title: "PMF アンケート",
  isActive: false,
  questions: [
    {
      type: "single_choice" as const,
      text: "使えなくなったらどう思いますか？",
      required: true,
      choices: [
        { value: "very_disappointed", label: "非常に残念" },
        { value: "not_disappointed", label: "残念ではない" },
      ],
    },
    {
      type: "text" as const,
      text: "一番の価値は何ですか？",
      required: false,
      choices: [],
    },
  ],
}

describe("CreateFeedbackSurveyUseCase", () => {
  it("generates ids for every level, derives sort orders, saves, and returns the mutation DTO", async () => {
    const deps = createDeps()
    const useCase = new CreateFeedbackSurveyUseCase(
      deps.repository,
      deps.idGenerator
    )

    const result = await useCase.execute(surveyInput)

    expect(deps.generate).toHaveBeenCalledTimes(5)
    expect(deps.save).toHaveBeenCalledOnce()
    const saved = deps.save.mock.calls[0]?.[0] as FeedbackSurveyEntity
    expect(saved.questions.map((question) => question.sortOrder)).toEqual([
      0, 1,
    ])
    expect(
      saved.questions[0]?.choices.map((choice) => choice.sortOrder)
    ).toEqual([0, 1])
    expect(result).toEqual({
      id: "survey-1",
      slug: "pmf-2026",
      title: "PMF アンケート",
      isActive: false,
      questions: [
        {
          id: "question-1",
          type: "single_choice",
          text: "使えなくなったらどう思いますか？",
          required: true,
          sortOrder: 0,
          choices: [
            {
              value: "very_disappointed",
              label: "非常に残念",
              sortOrder: 0,
            },
            {
              value: "not_disappointed",
              label: "残念ではない",
              sortOrder: 1,
            },
          ],
        },
        {
          id: "question-2",
          type: "text",
          text: "一番の価値は何ですか？",
          required: false,
          sortOrder: 1,
          choices: [],
        },
      ],
    })
    expect(deps.activateExclusively).not.toHaveBeenCalled()
  })

  it("creates an inactive survey without questions", async () => {
    const deps = createDeps({
      generate: vi.fn().mockReturnValue("survey-empty"),
    })
    const useCase = new CreateFeedbackSurveyUseCase(
      deps.repository,
      deps.idGenerator
    )

    const result = await useCase.execute({
      slug: "draft",
      title: "下書き",
      isActive: false,
      questions: [],
    })

    expect(result.questions).toEqual([])
    expect(deps.save).toHaveBeenCalledOnce()
    expect(deps.activateExclusively).not.toHaveBeenCalled()
  })

  it("saves before exclusively activating the saved entity", async () => {
    const calls: string[] = []
    let persisted: FeedbackSurveyEntity | undefined
    const save = vi
      .fn()
      .mockImplementation(async (entity: FeedbackSurveyEntity) => {
        calls.push("save")
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
    const deps = createDeps({ save, activateExclusively })
    const useCase = new CreateFeedbackSurveyUseCase(
      deps.repository,
      deps.idGenerator
    )

    const result = await useCase.execute({ ...surveyInput, isActive: true })

    expect(result.isActive).toBe(true)
    expect(result.id).toBe("persisted-survey")
    expect(calls).toEqual(["save", "activateExclusively"])
    expect(activateExclusively).toHaveBeenCalledWith(persisted)
  })

  it("propagates a slug conflict without exclusively activating anything", async () => {
    const conflict = new FeedbackSurveySlugConflictError("pmf-2026")
    const deps = createDeps({ save: vi.fn().mockRejectedValue(conflict) })
    const useCase = new CreateFeedbackSurveyUseCase(
      deps.repository,
      deps.idGenerator
    )

    await expect(
      useCase.execute({ ...surveyInput, isActive: true })
    ).rejects.toBe(conflict)
    expect(deps.activateExclusively).not.toHaveBeenCalled()
  })

  it("rejects an active survey without questions before saving", async () => {
    const deps = createDeps({
      generate: vi.fn().mockReturnValue("survey-empty"),
    })
    const useCase = new CreateFeedbackSurveyUseCase(
      deps.repository,
      deps.idGenerator
    )

    await expect(
      useCase.execute({
        slug: "empty",
        title: "空のアンケート",
        isActive: true,
        questions: [],
      })
    ).rejects.toBeInstanceOf(EmptyActiveFeedbackSurveyError)
    expect(deps.save).not.toHaveBeenCalled()
    expect(deps.activateExclusively).not.toHaveBeenCalled()
  })
})
