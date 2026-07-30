import { describe, expect, it, vi } from "vitest"
import {
  EmptyActiveFeedbackSurveyError,
  FeedbackSurveyHasSubmissionsError,
  FeedbackSurveyMustBeInactiveError,
  FeedbackSurveySlugConflictError,
  InvalidArgumentError,
  UnknownFeedbackQuestionError,
} from "@workspace/domain"
import {
  ActiveFeedbackSurveyNotFoundError,
  FeedbackSurveyNotFoundError,
} from "../../application"
import { createTestApp } from "../../test-utils"
import { ErrorCodes } from "../errors"

const adminSession = {
  user: { id: "admin-1", role: "admin" },
  session: { id: "sess-1" },
}
const userSession = {
  user: { id: "user-1", role: "user" },
  session: { id: "sess-2" },
}

const surveyDto = {
  id: "survey-1",
  slug: "pmf-2026",
  title: "PMF アンケート",
  questions: [
    {
      id: "q-1",
      type: "single_choice" as const,
      text: "使えなくなったらどう思いますか？",
      required: true,
      sortOrder: 0,
      choices: [
        { value: "very_disappointed", label: "非常に残念", sortOrder: 0 },
      ],
    },
  ],
}

/** エラーレスポンスの code だけを見たいケース用。res.json() は unknown を返すため型を絞る。 */
async function errorBody(
  res: Response
): Promise<{ error: string; code: string }> {
  return (await res.json()) as { error: string; code: string }
}

function postSubmission(body: unknown): Request {
  return new Request("http://localhost/api/v1/feedback/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function postSurvey(body: unknown): Request {
  return new Request("http://localhost/api/v1/admin/feedback/surveys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function patchSurvey(surveyId: string, body: unknown): Request {
  return new Request(
    `http://localhost/api/v1/admin/feedback/surveys/${surveyId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  )
}

function patchSurveyQuestions(surveyId: string, body: unknown): Request {
  return new Request(
    `http://localhost/api/v1/admin/feedback/surveys/${surveyId}/questions`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  )
}

function duplicateSurvey(surveyId: string, body: unknown): Request {
  return new Request(
    `http://localhost/api/v1/admin/feedback/surveys/${surveyId}/duplicate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  )
}

const mutationDto = {
  id: "survey-1",
  slug: "pmf-2026",
  title: "PMF アンケート",
  isActive: false,
  questions: [
    {
      id: "question-1",
      type: "text" as const,
      text: "一番の価値は何ですか？",
      required: false,
      sortOrder: 0,
      choices: [],
    },
  ],
}

describe("GET /api/v1/feedback/survey", () => {
  it("returns 200 with the active survey for an authenticated user", async () => {
    const { app, getFeedbackSurvey } = createTestApp({
      getSession: vi.fn().mockResolvedValue(userSession),
      getFeedbackSurvey: vi.fn().mockResolvedValue(surveyDto),
    })

    const res = await app.request("/api/v1/feedback/survey")

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(surveyDto)
    expect(getFeedbackSurvey).toHaveBeenCalledOnce()
  })

  it("returns 401 without a session and does not query the survey", async () => {
    const { app, getFeedbackSurvey } = createTestApp({
      getSession: vi.fn().mockResolvedValue(null),
    })

    const res = await app.request("/api/v1/feedback/survey")

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({
      error: "Unauthorized",
      code: ErrorCodes.SESSION_INVALID,
    })
    expect(getFeedbackSurvey).not.toHaveBeenCalled()
  })

  it("returns 404 when no survey is active", async () => {
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(userSession),
      getFeedbackSurvey: vi
        .fn()
        .mockRejectedValue(new ActiveFeedbackSurveyNotFoundError()),
    })

    const res = await app.request("/api/v1/feedback/survey")

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({
      error: "No active feedback survey is available",
      code: ErrorCodes.FEEDBACK_SURVEY_NOT_FOUND,
    })
  })
})

describe("POST /api/v1/feedback/submissions", () => {
  const accepted = {
    id: "submission-1",
    surveyId: "survey-1",
    createdAt: new Date("2026-07-27T00:00:00.000Z"),
  }

  it("returns 201 and passes the answers with the session user id", async () => {
    const { app, submitFeedback } = createTestApp({
      getSession: vi.fn().mockResolvedValue(userSession),
      submitFeedback: vi.fn().mockResolvedValue(accepted),
    })

    const res = await app.request(
      postSubmission({
        answers: [{ questionId: "q-1", choiceValue: "very_disappointed" }],
      })
    )

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({
      id: "submission-1",
      surveyId: "survey-1",
      createdAt: "2026-07-27T00:00:00.000Z",
    })
    expect(submitFeedback).toHaveBeenCalledWith({
      userId: "user-1",
      answers: [{ questionId: "q-1", choiceValue: "very_disappointed" }],
    })
  })

  it("returns 401 without a session and does not submit", async () => {
    const { app, submitFeedback } = createTestApp({
      getSession: vi.fn().mockResolvedValue(null),
    })

    const res = await app.request(postSubmission({ answers: [] }))

    expect(res.status).toBe(401)
    expect(submitFeedback).not.toHaveBeenCalled()
  })

  it("rejects a body carrying userId so the submitter cannot be spoofed", async () => {
    const { app, submitFeedback } = createTestApp({
      getSession: vi.fn().mockResolvedValue(userSession),
    })

    const res = await app.request(
      postSubmission({
        userId: "victim-1",
        answers: [{ questionId: "q-1", textValue: "x" }],
      })
    )

    expect(res.status).toBe(400)
    expect((await errorBody(res)).code).toBe(ErrorCodes.VALIDATION_ERROR)
    expect(submitFeedback).not.toHaveBeenCalled()
  })

  it("returns 400 without calling the use case when a free-text answer exceeds 2000 characters", async () => {
    const { app, submitFeedback } = createTestApp({
      getSession: vi.fn().mockResolvedValue(userSession),
      submitFeedback: vi.fn().mockResolvedValue(accepted),
    })

    const res = await app.request(
      postSubmission({
        answers: [{ questionId: "q-1", textValue: "あ".repeat(2001) }],
      })
    )

    expect(res.status).toBe(400)
    expect((await errorBody(res)).code).toBe(ErrorCodes.VALIDATION_ERROR)
    expect(submitFeedback).not.toHaveBeenCalled()
  })

  it("accepts a free-text answer of exactly 2000 characters", async () => {
    const { app, submitFeedback } = createTestApp({
      getSession: vi.fn().mockResolvedValue(userSession),
      submitFeedback: vi.fn().mockResolvedValue(accepted),
    })

    const res = await app.request(
      postSubmission({
        answers: [{ questionId: "q-1", textValue: "あ".repeat(2000) }],
      })
    )

    expect(res.status).toBe(201)
    expect(submitFeedback).toHaveBeenCalledOnce()
  })

  it("returns 400 without calling the use case when the answer array is too long", async () => {
    const { app, submitFeedback } = createTestApp({
      getSession: vi.fn().mockResolvedValue(userSession),
    })

    const answers = Array.from({ length: 51 }, (_, index) => ({
      questionId: `q-${index}`,
      textValue: "x",
    }))
    const res = await app.request(postSubmission({ answers }))

    expect(res.status).toBe(400)
    expect(submitFeedback).not.toHaveBeenCalled()
  })

  it("returns 400 FEEDBACK_INVALID_ANSWER when the answers violate the survey contract", async () => {
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(userSession),
      submitFeedback: vi
        .fn()
        .mockRejectedValue(new UnknownFeedbackQuestionError("q-9")),
    })

    const res = await app.request(
      postSubmission({ answers: [{ questionId: "q-9", textValue: "x" }] })
    )

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'Unknown feedback question: questionId="q-9"',
      code: ErrorCodes.FEEDBACK_INVALID_ANSWER,
    })
  })

  it("returns 404 when no survey is active", async () => {
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(userSession),
      submitFeedback: vi
        .fn()
        .mockRejectedValue(new ActiveFeedbackSurveyNotFoundError()),
    })

    const res = await app.request(
      postSubmission({ answers: [{ questionId: "q-1", textValue: "x" }] })
    )

    expect(res.status).toBe(404)
    expect((await errorBody(res)).code).toBe(
      ErrorCodes.FEEDBACK_SURVEY_NOT_FOUND
    )
  })

  it("returns 500 for a domain error that is not an answer-contract violation", async () => {
    // 壊れた DB データからの復元失敗 (InvalidArgumentError) を利用者の入力不備として
    // 400 に丸めないことを固定する。DomainError を一律 400 に写すと障害を見逃す。
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(userSession),
      submitFeedback: vi
        .fn()
        .mockRejectedValue(new InvalidArgumentError("corrupt survey row")),
    })

    const res = await app.request(
      postSubmission({ answers: [{ questionId: "q-1", textValue: "x" }] })
    )

    expect(res.status).toBe(500)
    expect((await errorBody(res)).code).toBe(ErrorCodes.INTERNAL_ERROR)
  })
})

describe("POST /api/v1/admin/feedback/surveys", () => {
  const validBody = {
    slug: "pmf-2026",
    title: "PMF アンケート",
    questions: [{ type: "text", text: "一番の価値は何ですか？" }],
  }

  it("returns 201 and passes route defaults to the use case", async () => {
    const { app, createFeedbackSurvey } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      createFeedbackSurvey: vi.fn().mockResolvedValue(mutationDto),
    })

    const res = await app.request(postSurvey(validBody))

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual(mutationDto)
    expect(createFeedbackSurvey).toHaveBeenCalledWith({
      slug: "pmf-2026",
      title: "PMF アンケート",
      isActive: false,
      questions: [
        {
          type: "text",
          text: "一番の価値は何ですか？",
          required: false,
          choices: [],
        },
      ],
    })
  })

  it("defaults an omitted questions array to an empty inactive draft", async () => {
    const emptyDraft = { ...mutationDto, questions: [] }
    const { app, createFeedbackSurvey } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      createFeedbackSurvey: vi.fn().mockResolvedValue(emptyDraft),
    })

    const res = await app.request(
      postSurvey({ slug: "draft", title: "Draft survey" })
    )

    expect(res.status).toBe(201)
    expect(createFeedbackSurvey).toHaveBeenCalledWith({
      slug: "draft",
      title: "Draft survey",
      isActive: false,
      questions: [],
    })
  })

  it.each([
    ["an invalid slug", { ...validBody, slug: "PMF_invalid" }],
    ["an overlong slug", { ...validBody, slug: "x".repeat(65) }],
    [
      "more than 50 questions",
      {
        ...validBody,
        questions: Array.from({ length: 51 }, () => ({
          type: "text",
          text: "Question",
        })),
      },
    ],
    [
      "more than 20 choices",
      {
        ...validBody,
        questions: [
          {
            type: "single_choice",
            text: "Choose",
            choices: Array.from({ length: 21 }, (_, index) => ({
              value: `choice-${index}`,
              label: `Choice ${index}`,
            })),
          },
        ],
      },
    ],
    [
      "choices on a text question",
      {
        ...validBody,
        questions: [
          {
            type: "text",
            text: "Question",
            choices: [{ value: "x", label: "X" }],
          },
        ],
      },
    ],
    [
      "a single-choice question without choices",
      {
        ...validBody,
        questions: [{ type: "single_choice", text: "Question" }],
      },
    ],
    [
      "duplicate choice values",
      {
        ...validBody,
        questions: [
          {
            type: "single_choice",
            text: "Question",
            choices: [
              { value: "same", label: "A" },
              { value: "same", label: "B" },
            ],
          },
        ],
      },
    ],
    [
      "an active survey without questions",
      { slug: "empty", title: "Empty", isActive: true, questions: [] },
    ],
    ["an unknown top-level key", { ...validBody, ownerId: "user-1" }],
    [
      "an unknown question key",
      {
        ...validBody,
        questions: [{ type: "text", text: "Question", serverOnly: true }],
      },
    ],
    [
      "an unknown choice key",
      {
        ...validBody,
        questions: [
          {
            type: "single_choice",
            text: "Question",
            choices: [{ value: "x", label: "X", id: "client-id" }],
          },
        ],
      },
    ],
  ])("returns 400 for %s", async (_label, body) => {
    const { app, createFeedbackSurvey } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
    })

    const res = await app.request(postSurvey(body))

    expect(res.status).toBe(400)
    expect((await errorBody(res)).code).toBe(ErrorCodes.VALIDATION_ERROR)
    expect(createFeedbackSurvey).not.toHaveBeenCalled()
  })

  it("returns 401 without a session", async () => {
    const { app, createFeedbackSurvey } = createTestApp({
      getSession: vi.fn().mockResolvedValue(null),
    })

    const res = await app.request(postSurvey(validBody))

    expect(res.status).toBe(401)
    expect(createFeedbackSurvey).not.toHaveBeenCalled()
  })

  it("returns 403 for a non-admin user", async () => {
    const { app, createFeedbackSurvey } = createTestApp({
      getSession: vi.fn().mockResolvedValue(userSession),
    })

    const res = await app.request(postSurvey(validBody))

    expect(res.status).toBe(403)
    expect(createFeedbackSurvey).not.toHaveBeenCalled()
  })

  it("returns 409 for a slug conflict", async () => {
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      createFeedbackSurvey: vi
        .fn()
        .mockRejectedValue(new FeedbackSurveySlugConflictError("pmf-2026")),
    })

    const res = await app.request(postSurvey(validBody))

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: 'FeedbackSurvey slug is already used: "pmf-2026"',
      code: ErrorCodes.FEEDBACK_SURVEY_SLUG_CONFLICT,
    })
  })

  it("returns 409 when the domain rejects publication", async () => {
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      createFeedbackSurvey: vi
        .fn()
        .mockRejectedValue(new EmptyActiveFeedbackSurveyError("survey-1")),
    })

    const res = await app.request(postSurvey(validBody))

    expect(res.status).toBe(409)
    expect((await errorBody(res)).code).toBe(
      ErrorCodes.FEEDBACK_SURVEY_NOT_PUBLISHABLE
    )
  })

  it("returns 500 for an InvalidArgumentError missed by route validation", async () => {
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      createFeedbackSurvey: vi
        .fn()
        .mockRejectedValue(new InvalidArgumentError("validation gap")),
    })

    const res = await app.request(postSurvey(validBody))

    expect(res.status).toBe(500)
    expect((await errorBody(res)).code).toBe(ErrorCodes.INTERNAL_ERROR)
  })
})

describe("PATCH /api/v1/admin/feedback/surveys/{surveyId}", () => {
  it.each([
    [
      "all mutable fields",
      { slug: "new-slug", title: "New title", isActive: true },
    ],
    ["isActive only", { isActive: false }],
    ["title only", { title: "New title" }],
  ])("returns 200 when updating %s", async (_label, body) => {
    const result = {
      ...mutationDto,
      slug: "slug" in body ? body.slug : mutationDto.slug,
      title: "title" in body ? body.title : mutationDto.title,
      isActive: "isActive" in body ? body.isActive : mutationDto.isActive,
    }
    const { app, updateFeedbackSurvey } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      updateFeedbackSurvey: vi.fn().mockResolvedValue(result),
    })

    const res = await app.request(patchSurvey("survey-1", body))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(result)
    expect(updateFeedbackSurvey).toHaveBeenCalledWith({
      surveyId: "survey-1",
      ...body,
    })
  })

  it.each([
    ["an empty body", {}],
    ["an unknown key", { createdAt: "2026-01-01" }],
    ["an invalid slug", { slug: "UPPER_CASE" }],
  ])("returns 400 for %s", async (_label, body) => {
    const { app, updateFeedbackSurvey } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
    })

    const res = await app.request(patchSurvey("survey-1", body))

    expect(res.status).toBe(400)
    expect((await errorBody(res)).code).toBe(ErrorCodes.VALIDATION_ERROR)
    expect(updateFeedbackSurvey).not.toHaveBeenCalled()
  })

  it("validates an empty body before looking up a missing survey", async () => {
    const { app, updateFeedbackSurvey } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      updateFeedbackSurvey: vi
        .fn()
        .mockRejectedValue(new FeedbackSurveyNotFoundError("missing")),
    })

    const res = await app.request(patchSurvey("missing", {}))

    expect(res.status).toBe(400)
    expect(updateFeedbackSurvey).not.toHaveBeenCalled()
  })

  it("returns 401 without a session", async () => {
    const { app, updateFeedbackSurvey } = createTestApp({
      getSession: vi.fn().mockResolvedValue(null),
    })

    const res = await app.request(
      patchSurvey("survey-1", { title: "New title" })
    )

    expect(res.status).toBe(401)
    expect(updateFeedbackSurvey).not.toHaveBeenCalled()
  })

  it("returns 403 for a non-admin user", async () => {
    const { app, updateFeedbackSurvey } = createTestApp({
      getSession: vi.fn().mockResolvedValue(userSession),
    })

    const res = await app.request(
      patchSurvey("survey-1", { title: "New title" })
    )

    expect(res.status).toBe(403)
    expect(updateFeedbackSurvey).not.toHaveBeenCalled()
  })

  it("returns 404 for an unknown survey", async () => {
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      updateFeedbackSurvey: vi
        .fn()
        .mockRejectedValue(new FeedbackSurveyNotFoundError("missing")),
    })

    const res = await app.request(
      patchSurvey("missing", { title: "New title" })
    )

    expect(res.status).toBe(404)
    expect((await errorBody(res)).code).toBe(
      ErrorCodes.FEEDBACK_SURVEY_NOT_FOUND
    )
  })

  it.each([
    [
      "a slug conflict",
      new FeedbackSurveySlugConflictError("duplicate"),
      ErrorCodes.FEEDBACK_SURVEY_SLUG_CONFLICT,
    ],
    [
      "an unpublishable survey",
      new EmptyActiveFeedbackSurveyError("survey-1"),
      ErrorCodes.FEEDBACK_SURVEY_NOT_PUBLISHABLE,
    ],
  ])("returns 409 for %s", async (_label, error, code) => {
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      updateFeedbackSurvey: vi.fn().mockRejectedValue(error),
    })

    const res = await app.request(patchSurvey("survey-1", { isActive: true }))

    expect(res.status).toBe(409)
    expect((await errorBody(res)).code).toBe(code)
  })

  it("delegates unexpected errors to the central 500 handler", async () => {
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      updateFeedbackSurvey: vi
        .fn()
        .mockRejectedValue(new InvalidArgumentError("validation gap")),
    })

    const res = await app.request(
      patchSurvey("survey-1", { title: "New title" })
    )

    expect(res.status).toBe(500)
    expect((await errorBody(res)).code).toBe(ErrorCodes.INTERNAL_ERROR)
  })
})

describe("PATCH /api/v1/admin/feedback/surveys/{surveyId}/questions", () => {
  const body = {
    questions: [{ type: "text", text: "新しい設問" }],
  }

  it("returns 200 and passes the complete normalized question set", async () => {
    const { app, replaceFeedbackSurveyQuestions } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      replaceFeedbackSurveyQuestions: vi.fn().mockResolvedValue(mutationDto),
    })

    const res = await app.request(patchSurveyQuestions("survey-1", body))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(mutationDto)
    expect(replaceFeedbackSurveyQuestions).toHaveBeenCalledWith({
      surveyId: "survey-1",
      questions: [
        {
          type: "text",
          text: "新しい設問",
          required: false,
          choices: [],
        },
      ],
    })
  })

  it.each([
    [
      new FeedbackSurveyMustBeInactiveError("survey-1"),
      ErrorCodes.FEEDBACK_SURVEY_MUST_BE_INACTIVE,
    ],
    [
      new FeedbackSurveyHasSubmissionsError("survey-1"),
      ErrorCodes.FEEDBACK_SURVEY_HAS_SUBMISSIONS,
    ],
  ])("returns 409 for a protected survey", async (error, code) => {
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      replaceFeedbackSurveyQuestions: vi.fn().mockRejectedValue(error),
    })

    const res = await app.request(patchSurveyQuestions("survey-1", body))

    expect(res.status).toBe(409)
    expect((await errorBody(res)).code).toBe(code)
  })

  it("returns 404 when the survey does not exist", async () => {
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      replaceFeedbackSurveyQuestions: vi
        .fn()
        .mockRejectedValue(new FeedbackSurveyNotFoundError("missing")),
    })

    const res = await app.request(patchSurveyQuestions("missing", body))

    expect(res.status).toBe(404)
    expect((await errorBody(res)).code).toBe(
      ErrorCodes.FEEDBACK_SURVEY_NOT_FOUND
    )
  })

  it("rejects a partial or unknown-key body before the use case", async () => {
    const { app, replaceFeedbackSurveyQuestions } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
    })

    const res = await app.request(
      patchSurveyQuestions("survey-1", { title: "部分更新" })
    )

    expect(res.status).toBe(400)
    expect(replaceFeedbackSurveyQuestions).not.toHaveBeenCalled()
  })
})

describe("POST /api/v1/admin/feedback/surveys/{surveyId}/duplicate", () => {
  const body = { slug: "pmf-copy", title: "PMF コピー" }

  it("returns 201 with the new inactive survey", async () => {
    const duplicate = { ...mutationDto, id: "copy", slug: "pmf-copy" }
    const { app, duplicateFeedbackSurvey } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      duplicateFeedbackSurvey: vi.fn().mockResolvedValue(duplicate),
    })

    const res = await app.request(duplicateSurvey("survey-1", body))

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual(duplicate)
    expect(duplicateFeedbackSurvey).toHaveBeenCalledWith({
      surveyId: "survey-1",
      ...body,
    })
  })

  it("returns 409 for a duplicate slug", async () => {
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      duplicateFeedbackSurvey: vi
        .fn()
        .mockRejectedValue(new FeedbackSurveySlugConflictError("pmf-copy")),
    })

    const res = await app.request(duplicateSurvey("survey-1", body))

    expect(res.status).toBe(409)
    expect((await errorBody(res)).code).toBe(
      ErrorCodes.FEEDBACK_SURVEY_SLUG_CONFLICT
    )
  })

  it("returns 404 when the source survey does not exist", async () => {
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      duplicateFeedbackSurvey: vi
        .fn()
        .mockRejectedValue(new FeedbackSurveyNotFoundError("missing")),
    })

    const res = await app.request(duplicateSurvey("missing", body))

    expect(res.status).toBe(404)
    expect((await errorBody(res)).code).toBe(
      ErrorCodes.FEEDBACK_SURVEY_NOT_FOUND
    )
  })
})

describe("DELETE /api/v1/admin/feedback/surveys/{surveyId}", () => {
  it("returns 204 when an unsubmitted draft is deleted", async () => {
    const { app, deleteFeedbackSurvey } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      deleteFeedbackSurvey: vi.fn().mockResolvedValue(undefined),
    })

    const res = await app.request("/api/v1/admin/feedback/surveys/survey-1", {
      method: "DELETE",
    })

    expect(res.status).toBe(204)
    expect(await res.text()).toBe("")
    expect(deleteFeedbackSurvey).toHaveBeenCalledWith({
      surveyId: "survey-1",
    })
  })

  it("returns 409 without deleting a survey that has submissions", async () => {
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      deleteFeedbackSurvey: vi
        .fn()
        .mockRejectedValue(new FeedbackSurveyHasSubmissionsError("survey-1")),
    })

    const res = await app.request("/api/v1/admin/feedback/surveys/survey-1", {
      method: "DELETE",
    })

    expect(res.status).toBe(409)
    expect((await errorBody(res)).code).toBe(
      ErrorCodes.FEEDBACK_SURVEY_HAS_SUBMISSIONS
    )
  })

  it("returns 404 when the survey does not exist", async () => {
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      deleteFeedbackSurvey: vi
        .fn()
        .mockRejectedValue(new FeedbackSurveyNotFoundError("missing")),
    })

    const res = await app.request("/api/v1/admin/feedback/surveys/missing", {
      method: "DELETE",
    })

    expect(res.status).toBe(404)
    expect((await errorBody(res)).code).toBe(
      ErrorCodes.FEEDBACK_SURVEY_NOT_FOUND
    )
  })
})

describe("GET /api/v1/admin/feedback/surveys", () => {
  const listResult = {
    items: [
      {
        id: "survey-1",
        slug: "pmf-2026",
        title: "PMF アンケート",
        isActive: true,
        questionCount: 4,
        submissionCount: 12,
        createdAt: new Date("2026-07-26T00:00:00.000Z"),
      },
    ],
  }

  it("returns 200 with every survey for an admin", async () => {
    const { app, listFeedbackSurveys } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      listFeedbackSurveys: vi.fn().mockResolvedValue(listResult),
    })

    const res = await app.request("/api/v1/admin/feedback/surveys")

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(JSON.parse(JSON.stringify(listResult)))
    expect(listFeedbackSurveys).toHaveBeenCalledOnce()
  })

  it("returns 401 without a session and does not query surveys", async () => {
    const { app, listFeedbackSurveys } = createTestApp({
      getSession: vi.fn().mockResolvedValue(null),
    })

    const res = await app.request("/api/v1/admin/feedback/surveys")

    expect(res.status).toBe(401)
    expect(listFeedbackSurveys).not.toHaveBeenCalled()
  })

  it("returns 403 for a non-admin user and does not query surveys", async () => {
    const { app, listFeedbackSurveys } = createTestApp({
      getSession: vi.fn().mockResolvedValue(userSession),
    })

    const res = await app.request("/api/v1/admin/feedback/surveys")

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      error: "Forbidden",
      code: ErrorCodes.FORBIDDEN,
    })
    expect(listFeedbackSurveys).not.toHaveBeenCalled()
  })
})

describe("GET /api/v1/admin/feedback/surveys/{surveyId}", () => {
  const detail = {
    ...surveyDto,
    isActive: false,
    createdAt: new Date("2026-07-26T00:00:00.000Z"),
  }

  it("returns 200 with the survey questions for an admin", async () => {
    const { app, getFeedbackSurveyDetail } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      getFeedbackSurveyDetail: vi.fn().mockResolvedValue(detail),
    })

    const res = await app.request("/api/v1/admin/feedback/surveys/survey-1")

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(JSON.parse(JSON.stringify(detail)))
    expect(getFeedbackSurveyDetail).toHaveBeenCalledWith({
      surveyId: "survey-1",
    })
  })

  it("returns 404 when no survey has that id", async () => {
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      getFeedbackSurveyDetail: vi
        .fn()
        .mockRejectedValue(new FeedbackSurveyNotFoundError("survey-9")),
    })

    const res = await app.request("/api/v1/admin/feedback/surveys/survey-9")

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({
      error: 'Feedback survey not found: surveyId="survey-9"',
      code: ErrorCodes.FEEDBACK_SURVEY_NOT_FOUND,
    })
  })

  it("returns 400 for a surveyId longer than 64 characters", async () => {
    const { app, getFeedbackSurveyDetail } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
    })

    const res = await app.request(
      `/api/v1/admin/feedback/surveys/${"x".repeat(65)}`
    )

    expect(res.status).toBe(400)
    expect((await errorBody(res)).code).toBe(ErrorCodes.VALIDATION_ERROR)
    expect(getFeedbackSurveyDetail).not.toHaveBeenCalled()
  })

  it("returns 401 without a session and does not query the survey", async () => {
    const { app, getFeedbackSurveyDetail } = createTestApp({
      getSession: vi.fn().mockResolvedValue(null),
    })

    const res = await app.request("/api/v1/admin/feedback/surveys/survey-1")

    expect(res.status).toBe(401)
    expect(getFeedbackSurveyDetail).not.toHaveBeenCalled()
  })

  it("returns 403 for a non-admin user and does not query the survey", async () => {
    const { app, getFeedbackSurveyDetail } = createTestApp({
      getSession: vi.fn().mockResolvedValue(userSession),
    })

    const res = await app.request("/api/v1/admin/feedback/surveys/survey-1")

    expect(res.status).toBe(403)
    expect(getFeedbackSurveyDetail).not.toHaveBeenCalled()
  })
})

describe("GET /api/v1/admin/feedback/submissions", () => {
  const listResult = {
    items: [
      {
        id: "submission-1",
        surveyId: "survey-1",
        user: {
          id: "user-1",
          email: "user@example.com",
          name: "User",
          displayName: null,
        },
        createdAt: new Date("2026-07-27T00:00:00.000Z"),
        answers: [
          {
            questionId: "q-1",
            questionText: "使えなくなったらどう思いますか？",
            choiceValue: "very_disappointed",
            choiceLabel: "非常に残念",
            textValue: null,
          },
        ],
      },
    ],
    total: 1,
    limit: 20,
    offset: 0,
  }

  it("returns 200 with the default paging for an admin", async () => {
    const { app, listFeedbackSubmissions } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      listFeedbackSubmissions: vi.fn().mockResolvedValue(listResult),
    })

    const res = await app.request("/api/v1/admin/feedback/submissions")

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(JSON.parse(JSON.stringify(listResult)))
    expect(listFeedbackSubmissions).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
    })
  })

  it("passes limit, offset and surveyId through", async () => {
    const { app, listFeedbackSubmissions } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      listFeedbackSubmissions: vi
        .fn()
        .mockResolvedValue({ ...listResult, limit: 5, offset: 10 }),
    })

    const res = await app.request(
      "/api/v1/admin/feedback/submissions?limit=5&offset=10&surveyId=survey-1"
    )

    expect(res.status).toBe(200)
    expect(listFeedbackSubmissions).toHaveBeenCalledWith({
      limit: 5,
      offset: 10,
      surveyId: "survey-1",
    })
  })

  it.each([
    ["limit above the maximum", "?limit=101"],
    ["a negative offset", "?offset=-1"],
    ["a non-numeric limit", "?limit=abc"],
  ])("returns 400 for %s", async (_label, query) => {
    const { app, listFeedbackSubmissions } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
    })

    const res = await app.request(`/api/v1/admin/feedback/submissions${query}`)

    expect(res.status).toBe(400)
    expect((await errorBody(res)).code).toBe(ErrorCodes.VALIDATION_ERROR)
    expect(listFeedbackSubmissions).not.toHaveBeenCalled()
  })

  it("returns 401 without a session and does not query submissions", async () => {
    const { app, listFeedbackSubmissions } = createTestApp({
      getSession: vi.fn().mockResolvedValue(null),
    })

    const res = await app.request("/api/v1/admin/feedback/submissions")

    expect(res.status).toBe(401)
    expect(listFeedbackSubmissions).not.toHaveBeenCalled()
  })

  it("returns 403 for a non-admin user and does not query submissions", async () => {
    const { app, listFeedbackSubmissions } = createTestApp({
      getSession: vi.fn().mockResolvedValue(userSession),
    })

    const res = await app.request("/api/v1/admin/feedback/submissions")

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      error: "Forbidden",
      code: ErrorCodes.FORBIDDEN,
    })
    expect(listFeedbackSubmissions).not.toHaveBeenCalled()
  })
})

describe("GET /api/v1/admin/feedback/summary", () => {
  const summary = {
    surveyId: "survey-1",
    respondentCount: 2,
    tallies: [
      { questionId: "q-1", choiceValue: "very_disappointed", count: 2 },
    ],
  }

  it("returns 200 with the tallies for an admin", async () => {
    const { app, summarizeFeedback } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
      summarizeFeedback: vi.fn().mockResolvedValue(summary),
    })

    const res = await app.request(
      "/api/v1/admin/feedback/summary?surveyId=survey-1"
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(summary)
    expect(summarizeFeedback).toHaveBeenCalledWith({ surveyId: "survey-1" })
  })

  it("returns 400 when surveyId is missing", async () => {
    const { app, summarizeFeedback } = createTestApp({
      getSession: vi.fn().mockResolvedValue(adminSession),
    })

    const res = await app.request("/api/v1/admin/feedback/summary")

    expect(res.status).toBe(400)
    expect((await errorBody(res)).code).toBe(ErrorCodes.VALIDATION_ERROR)
    expect(summarizeFeedback).not.toHaveBeenCalled()
  })

  it("returns 403 for a non-admin user and does not summarize", async () => {
    const { app, summarizeFeedback } = createTestApp({
      getSession: vi.fn().mockResolvedValue(userSession),
    })

    const res = await app.request(
      "/api/v1/admin/feedback/summary?surveyId=survey-1"
    )

    expect(res.status).toBe(403)
    expect(summarizeFeedback).not.toHaveBeenCalled()
  })
})
