import { describe, expect, it, vi } from "vitest"
import {
  FeedbackChoice,
  FeedbackQuestionEntity,
  FeedbackSubmissionEntity,
  FeedbackSurveyEntity,
  InvalidArgumentError,
  UnknownFeedbackQuestionError,
} from "@workspace/domain"
import type {
  IFeedbackSubmissionRepository,
  IFeedbackSurveyRepository,
  IIdGenerator,
} from "@workspace/domain"
import {
  ActiveFeedbackSurveyNotFoundError,
  InvalidFeedbackAnswerError,
} from "../errors"
import { SubmitFeedbackUseCase } from "./submit-feedback.use-case"

function createSurvey(): FeedbackSurveyEntity {
  return FeedbackSurveyEntity.reconstitute(
    "survey-1",
    "pmf-2026",
    "PMF アンケート",
    true,
    [
      FeedbackQuestionEntity.reconstitute(
        "q-1",
        "single_choice",
        "どう思いますか？",
        true,
        0,
        [
          FeedbackChoice.reconstitute(
            "c-1",
            "very_disappointed",
            "非常に残念",
            0
          ),
        ]
      ),
      FeedbackQuestionEntity.reconstitute(
        "q-2",
        "text",
        "一番の価値は？",
        false,
        1,
        []
      ),
    ]
  )
}

function createDeps(
  overrides: {
    findActive?: ReturnType<typeof vi.fn>
    save?: ReturnType<typeof vi.fn>
    generate?: ReturnType<typeof vi.fn>
  } = {}
) {
  const findActive =
    overrides.findActive ?? vi.fn().mockResolvedValue(createSurvey())
  // 既定では save をエコーにして、UseCase が「保存結果」を返していることを検証できるようにする。
  const save =
    overrides.save ?? vi.fn().mockImplementation(async (entity) => entity)
  const generate = overrides.generate ?? vi.fn().mockReturnValue("submission-1")

  const surveyRepository = {
    findActive,
  } as unknown as IFeedbackSurveyRepository
  const submissionRepository = {
    save,
    findById: vi.fn(),
  } as unknown as IFeedbackSubmissionRepository
  const idGenerator = { generate } as unknown as IIdGenerator

  return {
    surveyRepository,
    submissionRepository,
    idGenerator,
    findActive,
    save,
    generate,
  }
}

describe("SubmitFeedbackUseCase", () => {
  it("saves a submission built from the active survey and returns the accepted DTO", async () => {
    const deps = createDeps()
    const useCase = new SubmitFeedbackUseCase(
      deps.surveyRepository,
      deps.submissionRepository,
      deps.idGenerator
    )

    const result = await useCase.execute({
      userId: "user-1",
      answers: [
        { questionId: "q-1", choiceValue: "very_disappointed" },
        { questionId: "q-2", textValue: "毎日使っている" },
      ],
    })

    expect(deps.save).toHaveBeenCalledOnce()
    const [saved] = deps.save.mock.calls[0] as [FeedbackSubmissionEntity]
    expect(saved.id).toBe("submission-1")
    expect(saved.surveyId).toBe("survey-1")
    expect(saved.userId).toBe("user-1")
    // 選択式は choiceValue から choiceId へ解決され、自由記述は textValue のまま保存される。
    expect(saved.answers).toEqual([
      { questionId: "q-1", choiceId: "c-1", textValue: null },
      { questionId: "q-2", choiceId: null, textValue: "毎日使っている" },
    ])
    expect(result).toEqual({
      id: "submission-1",
      surveyId: "survey-1",
      createdAt: saved.createdAt,
    })
  })

  it("uses the id from the generator rather than any client-supplied value", async () => {
    const deps = createDeps({
      generate: vi.fn().mockReturnValue("generated-id"),
    })
    const useCase = new SubmitFeedbackUseCase(
      deps.surveyRepository,
      deps.submissionRepository,
      deps.idGenerator
    )

    const result = await useCase.execute({
      userId: "user-1",
      answers: [{ questionId: "q-1", choiceValue: "very_disappointed" }],
    })

    expect(deps.generate).toHaveBeenCalledOnce()
    expect(result.id).toBe("generated-id")
  })

  it("throws ActiveFeedbackSurveyNotFoundError and does not save when no survey is active", async () => {
    const deps = createDeps({ findActive: vi.fn().mockResolvedValue(null) })
    const useCase = new SubmitFeedbackUseCase(
      deps.surveyRepository,
      deps.submissionRepository,
      deps.idGenerator
    )

    await expect(
      useCase.execute({ userId: "user-1", answers: [] })
    ).rejects.toBeInstanceOf(ActiveFeedbackSurveyNotFoundError)
    expect(deps.save).not.toHaveBeenCalled()
  })

  it("translates an unknown-question rule violation at the Application boundary", async () => {
    const deps = createDeps()
    const useCase = new SubmitFeedbackUseCase(
      deps.surveyRepository,
      deps.submissionRepository,
      deps.idGenerator
    )

    await expect(
      useCase.execute({
        userId: "user-1",
        answers: [{ questionId: "q-unknown", textValue: "hello" }],
      })
    ).rejects.toMatchObject({
      cause: expect.any(UnknownFeedbackQuestionError),
      name: "InvalidFeedbackAnswerError",
    })
    expect(deps.save).not.toHaveBeenCalled()
  })

  it("translates a missing-answer rule violation at the Application boundary", async () => {
    const deps = createDeps()
    const useCase = new SubmitFeedbackUseCase(
      deps.surveyRepository,
      deps.submissionRepository,
      deps.idGenerator
    )

    await expect(
      useCase.execute({
        userId: "user-1",
        answers: [{ questionId: "q-2", textValue: "value" }],
      })
    ).rejects.toBeInstanceOf(InvalidFeedbackAnswerError)
    expect(deps.save).not.toHaveBeenCalled()
  })

  it("does not translate an invariant error into an expected Application error", async () => {
    const invariantError = new InvalidArgumentError("corrupt survey row")
    const deps = createDeps({
      findActive: vi.fn().mockRejectedValue(invariantError),
    })
    const useCase = new SubmitFeedbackUseCase(
      deps.surveyRepository,
      deps.submissionRepository,
      deps.idGenerator
    )

    await expect(
      useCase.execute({ userId: "user-1", answers: [] })
    ).rejects.toBe(invariantError)
    expect(deps.save).not.toHaveBeenCalled()
  })
})
