import { describe, expect, it, vi } from "vitest"
import {
  ActiveFeedbackSurveyNotFoundError,
  InvalidFeedbackAnswerError,
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
        .mockRejectedValue(
          new InvalidFeedbackAnswerError(
            'Unknown feedback question: questionId="q-9"'
          )
        ),
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

  it("returns 500 for an unexpected error", async () => {
    // DomainInvariantError を含む想定外エラーは ApplicationError に翻訳されず、
    // 500 と監視対象になる。Presentation は Domain の具体型を知る必要がない。
    const { app } = createTestApp({
      getSession: vi.fn().mockResolvedValue(userSession),
      submitFeedback: vi
        .fn()
        .mockRejectedValue(new Error("corrupt survey row")),
    })

    const res = await app.request(
      postSubmission({ answers: [{ questionId: "q-1", textValue: "x" }] })
    )

    expect(res.status).toBe(500)
    expect((await errorBody(res)).code).toBe(ErrorCodes.INTERNAL_ERROR)
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
