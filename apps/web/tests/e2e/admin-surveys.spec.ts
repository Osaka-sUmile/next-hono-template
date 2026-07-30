import { expect, test, type Page, type Route } from "@playwright/test"

/**
 * アンケート管理ページ(/admin/surveys)の e2e。
 *
 * CI では web を `next start` で単体起動するだけで API/DB は立てないため、
 * better-auth の `/api/auth/*` と REST の `/api/v1/admin/**` を route interception でモックする。
 * web と API は別オリジン(NEXT_PUBLIC_API_URL)なので、fulfill するレスポンスにも
 * ブラウザの CORS 検証が効く。CORS ヘッダの付与と OPTIONS プリフライト処理が必須。
 */

const FALLBACK_ORIGIN = "http://127.0.0.1:3000"

function corsHeaders(origin: string) {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers":
      "content-type, x-signup-intent, x-captcha-response",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
  }
}

const NOW = "2026-07-15T00:00:00.000Z"
const EXPIRES = "2026-07-22T00:00:00.000Z"

function makeAdminSession() {
  return {
    session: {
      id: "sess_1",
      token: "tok_1",
      userId: "user_1",
      expiresAt: EXPIRES,
      createdAt: NOW,
      updatedAt: NOW,
      ipAddress: "",
      userAgent: "",
    },
    user: {
      id: "user_1",
      email: "admin@example.com",
      emailVerified: true,
      name: "",
      image: null,
      createdAt: NOW,
      updatedAt: NOW,
      role: "admin",
      displayName: "管理者",
    },
  }
}

type SurveyItem = {
  id: string
  slug: string
  title: string
  isActive: boolean
  questionCount: number
  submissionCount: number
  createdAt: string
}

function initialSurveys(): SurveyItem[] {
  return [
    {
      id: "srv_1",
      slug: "pmf-2026",
      title: "PMF アンケート",
      isActive: true,
      questionCount: 4,
      submissionCount: 128,
      createdAt: "2026-07-01T00:00:00.000Z",
    },
    {
      id: "srv_2",
      slug: "draft-2026",
      title: "下書きアンケート",
      isActive: false,
      questionCount: 1,
      submissionCount: 0,
      createdAt: "2026-07-10T00:00:00.000Z",
    },
  ]
}

function draftSurveyDetail() {
  return {
    id: "srv_2",
    slug: "draft-2026",
    title: "下書きアンケート",
    isActive: false,
    createdAt: "2026-07-10T00:00:00.000Z",
    questions: [
      {
        id: "q_draft_1",
        type: "text" as const,
        text: "改善点を教えてください",
        required: false,
        sortOrder: 0,
        choices: [],
      },
    ],
  }
}

function paginatedSubmissions(surveyId: string, offset: number, limit: number) {
  const total = surveyId === "srv_2" ? 25 : 1
  const items = Array.from(
    { length: Math.min(limit, Math.max(0, total - offset)) },
    (_, index) => {
      const number = offset + index + 1
      return {
        id: `sub_${surveyId}_${number}`,
        surveyId,
        user: {
          id: `user_${number}`,
          email: `respondent${number}@example.com`,
          name: `回答者 ${number}`,
          displayName: `user${number}`,
        },
        createdAt: `2026-07-15T0${number % 10}:30:00.000Z`,
        answers: [
          {
            questionId: surveyId === "srv_2" ? "q_draft_1" : "q_2",
            questionText:
              surveyId === "srv_2"
                ? "改善点を教えてください"
                : "理由を教えてください",
            choiceValue: null,
            choiceLabel: null,
            textValue: `回答 ${number}`,
          },
        ],
      }
    }
  )

  return { items, total, limit, offset }
}

/**
 * `/api/auth/*` と `/api/v1/admin/**` をモックする。
 * surveys はテストごとの可変ステートとして持ち、POST/PATCH が反映された一覧を
 * 次の GET で返す(reload の副作用を検証するため)。
 */
async function mockSurveysFlow(page: Page, surveys: SurveyItem[]) {
  await page.route("**/api/auth/**", async (route) => {
    const request = route.request()
    const origin = request.headers()["origin"] ?? FALLBACK_ORIGIN
    const cors = corsHeaders(origin)

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors })
      return
    }

    const path = new URL(request.url()).pathname
    const body = path.endsWith("/get-session") ? makeAdminSession() : {}
    await route.fulfill({
      status: 200,
      headers: { ...cors, "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  })

  await page.route("**/api/v1/admin/**", async (route) => {
    const request = route.request()
    const origin = request.headers()["origin"] ?? FALLBACK_ORIGIN
    const cors = corsHeaders(origin)

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors })
      return
    }

    const path = new URL(request.url()).pathname
    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        headers: { ...cors, "content-type": "application/json" },
        body: JSON.stringify(body),
      })

    if (
      path.endsWith("/admin/feedback/surveys") &&
      request.method() === "GET"
    ) {
      await json(200, { items: surveys })
      return
    }

    const duplicateMatch = path.match(
      /\/admin\/feedback\/surveys\/([^/]+)\/duplicate$/
    )
    if (duplicateMatch && request.method() === "POST") {
      const source = surveys.find((survey) => survey.id === duplicateMatch[1])
      if (!source) {
        await json(404, {
          error: "survey not found",
          code: "FEEDBACK_SURVEY_NOT_FOUND",
        })
        return
      }
      const body = request.postDataJSON() as { slug: string; title: string }
      const duplicated = {
        id: `srv_${surveys.length + 1}`,
        slug: body.slug,
        title: body.title,
        isActive: false,
        questionCount: source.questionCount,
        submissionCount: 0,
        createdAt: NOW,
      }
      surveys.unshift(duplicated)
      await json(201, {
        id: duplicated.id,
        slug: duplicated.slug,
        title: duplicated.title,
        isActive: false,
        questions: [],
      })
      return
    }

    if (
      path.endsWith("/admin/feedback/surveys") &&
      request.method() === "POST"
    ) {
      const body = request.postDataJSON() as {
        slug: string
        title: string
        isActive?: boolean
        questions?: unknown[]
      }
      surveys.unshift({
        id: `srv_${surveys.length + 1}`,
        slug: body.slug,
        title: body.title,
        isActive: body.isActive ?? false,
        questionCount: body.questions?.length ?? 0,
        submissionCount: 0,
        createdAt: NOW,
      })
      await json(201, {
        id: surveys[0]!.id,
        slug: body.slug,
        title: body.title,
        isActive: body.isActive ?? false,
        questions: [],
      })
      return
    }

    if (
      path.endsWith("/admin/feedback/surveys/srv_1") &&
      request.method() === "GET"
    ) {
      await json(200, {
        id: "srv_1",
        slug: "pmf-2026",
        title: "PMF アンケート",
        isActive: true,
        createdAt: "2026-07-01T00:00:00.000Z",
        questions: [
          {
            id: "q_1",
            type: "single_choice",
            text: "おすすめ度を教えてください",
            required: true,
            sortOrder: 0,
            choices: [
              { value: "yes", label: "はい", sortOrder: 0 },
              { value: "no", label: "いいえ", sortOrder: 1 },
            ],
          },
          {
            id: "q_2",
            type: "text",
            text: "理由を教えてください",
            required: false,
            sortOrder: 1,
            choices: [],
          },
        ],
      })
      return
    }

    if (
      path.endsWith("/admin/feedback/surveys/srv_2") &&
      request.method() === "GET"
    ) {
      await json(200, draftSurveyDetail())
      return
    }

    const questionsPatchMatch = path.match(
      /\/admin\/feedback\/surveys\/([^/]+)\/questions$/
    )
    if (questionsPatchMatch && request.method() === "PATCH") {
      await json(200, { questions: route.request().postDataJSON().questions })
      return
    }

    if (
      path.endsWith("/admin/feedback/summary") &&
      request.method() === "GET"
    ) {
      const surveyId = new URL(request.url()).searchParams.get("surveyId")
      if (surveyId === "srv_2") {
        await json(200, {
          surveyId: "srv_2",
          respondentCount: 25,
          tallies: [],
        })
        return
      }

      await json(200, {
        surveyId: "srv_1",
        respondentCount: 1,
        tallies: [{ questionId: "q_1", choiceValue: "yes", count: 1 }],
      })
      return
    }

    if (
      path.endsWith("/admin/feedback/submissions") &&
      request.method() === "GET"
    ) {
      const url = new URL(request.url())
      const surveyId = url.searchParams.get("surveyId") ?? "srv_1"
      const offset = Number(url.searchParams.get("offset") ?? 0)
      const limit = Number(url.searchParams.get("limit") ?? 20)
      if (surveyId === "srv_2") {
        await json(200, paginatedSubmissions(surveyId, offset, limit))
        return
      }

      await json(200, {
        items: [
          {
            id: "sub_1",
            surveyId: "srv_1",
            user: {
              id: "user_2",
              email: "respondent@example.com",
              name: "回答 太郎",
              displayName: "たろう",
            },
            createdAt: "2026-07-15T03:30:00.000Z",
            answers: [
              {
                questionId: "q_1",
                questionText: "おすすめ度を教えてください",
                choiceValue: "yes",
                choiceLabel: "はい",
                textValue: null,
              },
              {
                questionId: "q_2",
                questionText: "理由を教えてください",
                choiceValue: null,
                choiceLabel: null,
                textValue: "操作が分かりやすかったです。",
              },
            ],
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      })
      return
    }

    const patchMatch = path.match(/\/admin\/feedback\/surveys\/([^/]+)$/)
    if (patchMatch && request.method() === "PATCH") {
      await handleSurveyPatch(route, json, surveys, patchMatch[1]!)
      return
    }

    if (patchMatch && request.method() === "DELETE") {
      const index = surveys.findIndex((survey) => survey.id === patchMatch[1])
      if (index < 0) {
        await json(404, {
          error: "survey not found",
          code: "FEEDBACK_SURVEY_NOT_FOUND",
        })
        return
      }
      surveys.splice(index, 1)
      await route.fulfill({ status: 204, headers: cors })
      return
    }

    await json(404, { error: "Not Found", code: "NOT_FOUND" })
  })
}

async function handleSurveyPatch(
  route: Route,
  json: (status: number, body: unknown) => Promise<void>,
  surveys: SurveyItem[],
  surveyId: string
) {
  const target = surveys.find((s) => s.id === surveyId)
  if (!target) {
    await json(404, {
      error: "survey not found",
      code: "FEEDBACK_SURVEY_NOT_FOUND",
    })
    return
  }
  const body = route.request().postDataJSON() as { isActive?: boolean }
  if (body.isActive === true && target.questionCount === 0) {
    await json(409, {
      error: "not publishable",
      code: "FEEDBACK_SURVEY_NOT_PUBLISHABLE",
    })
    return
  }
  if (body.isActive !== undefined) {
    // 実 API と同じく「同時にアクティブなのは 1 件」を保つ
    if (body.isActive) {
      for (const s of surveys) s.isActive = false
    }
    target.isActive = body.isActive
  }
  await json(200, {
    id: target.id,
    slug: target.slug,
    title: target.title,
    isActive: target.isActive,
    questions: [],
  })
}

test.describe("アンケート管理", () => {
  test("一覧にタイトル・slug・件数・有効状態が表示される", async ({ page }) => {
    await mockSurveysFlow(page, initialSurveys())

    await page.goto("/admin/surveys")

    await expect(
      page.getByRole("heading", { name: "アンケート" })
    ).toBeVisible()
    const activeRow = page.getByRole("row", { name: /PMF アンケート/ })
    await expect(activeRow.getByText("pmf-2026")).toBeVisible()
    await expect(activeRow.getByText("128")).toBeVisible()
    await expect(activeRow.getByText("有効", { exact: true })).toBeVisible()
    const draftRow = page.getByRole("row", { name: /下書きアンケート/ })
    await expect(draftRow.getByText("無効", { exact: true })).toBeVisible()
  })

  test("ダイアログからアンケートを作成すると POST され、一覧に追加される", async ({
    page,
  }) => {
    await mockSurveysFlow(page, initialSurveys())

    await page.goto("/admin/surveys")
    await page.getByRole("button", { name: "アンケートを作成" }).click()

    await page.getByLabel("タイトル").fill("新しいアンケート")
    await page.getByLabel("slug").fill("new-2027")
    await page.getByRole("button", { name: "設問を追加" }).click()
    await page.getByLabel("本文").fill("満足度を教えてください")
    await page.getByLabel("値", { exact: true }).fill("satisfied")
    await page.getByLabel("ラベル", { exact: true }).fill("満足")

    const postPromise = page.waitForRequest(
      (req) =>
        req.method() === "POST" &&
        req.url().includes("/api/v1/admin/feedback/surveys")
    )
    await page.getByRole("button", { name: "作成", exact: true }).click()

    const postRequest = await postPromise
    expect(postRequest.postDataJSON()).toEqual({
      slug: "new-2027",
      title: "新しいアンケート",
      isActive: false,
      questions: [
        {
          type: "single_choice",
          text: "満足度を教えてください",
          required: false,
          choices: [{ value: "satisfied", label: "満足" }],
        },
      ],
    })

    // reload 後、新しい行が一覧に現れる
    await expect(
      page.getByRole("row", { name: /新しいアンケート/ })
    ).toBeVisible()
  })

  test("有効化スイッチで PATCH され、他のアンケートが自動で無効になる", async ({
    page,
  }) => {
    await mockSurveysFlow(page, initialSurveys())

    await page.goto("/admin/surveys")
    await expect(
      page.getByRole("row", { name: /PMF アンケート/ }).getByText("有効", {
        exact: true,
      })
    ).toBeVisible()

    const patchPromise = page.waitForRequest(
      (req) =>
        req.method() === "PATCH" &&
        req.url().includes("/api/v1/admin/feedback/surveys/srv_2")
    )
    await page
      .getByRole("switch", { name: "下書きアンケート を有効化" })
      .click()

    const patchRequest = await patchPromise
    expect(patchRequest.postDataJSON()).toEqual({ isActive: true })

    // reload 後、有効/無効が入れ替わっている
    await expect(
      page.getByRole("row", { name: /下書きアンケート/ }).getByText("有効", {
        exact: true,
      })
    ).toBeVisible()
    await expect(
      page.getByRole("row", { name: /PMF アンケート/ }).getByText("無効", {
        exact: true,
      })
    ).toBeVisible()
  })

  test("下書きを複製すると、新しい非公開アンケートが一覧に追加される", async ({
    page,
  }) => {
    await mockSurveysFlow(page, initialSurveys())

    await page.goto("/admin/surveys")
    const draftRow = page.getByRole("row", { name: /下書きアンケート/ })
    await draftRow.getByRole("button", { name: "複製" }).click()
    await page.getByLabel("新しいタイトル").fill("下書きアンケート 2027")
    await page.getByLabel("新しい slug").fill("draft-2027")

    const duplicatePromise = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        request.url().includes("/admin/feedback/surveys/srv_2/duplicate")
    )
    await page.getByRole("button", { name: "複製する" }).click()

    expect((await duplicatePromise).postDataJSON()).toEqual({
      title: "下書きアンケート 2027",
      slug: "draft-2027",
    })
    await expect(
      page.getByRole("row", { name: /下書きアンケート 2027/ })
    ).toBeVisible()
  })

  test("未回答の下書きを確認後に削除すると一覧から消える", async ({ page }) => {
    await mockSurveysFlow(page, initialSurveys())

    await page.goto("/admin/surveys")
    await page.getByRole("button", { name: "下書きアンケート を削除" }).click()

    const deletePromise = page.waitForRequest(
      (request) =>
        request.method() === "DELETE" &&
        request.url().includes("/admin/feedback/surveys/srv_2")
    )
    await page.getByRole("button", { name: "完全に削除" }).click()

    await deletePromise
    await expect(
      page.getByRole("row", { name: /下書きアンケート/ })
    ).not.toBeVisible()
  })

  test("詳細で集計グラフと回答者・自由記述を表示する", async ({ page }) => {
    await mockSurveysFlow(page, initialSurveys())

    await page.goto("/admin/surveys/srv_1")

    await expect(
      page.getByRole("heading", { name: "PMF アンケート" })
    ).toBeVisible()
    await expect(page.getByText("回答者数 1 人")).toBeVisible()
    const summary = page.getByLabel("おすすめ度を教えてくださいの回答数")
    await expect(summary.getByText("はい")).toBeVisible()
    await expect(summary.getByText("1 件")).toBeVisible()
    await expect(summary.getByText("いいえ")).toBeVisible()
    await expect(summary.getByText("0 件")).toBeVisible()

    const submissionRow = page.getByRole("row", {
      name: /respondent@example.com/,
    })
    await expect(submissionRow.getByText("回答 太郎")).toBeVisible()
    await expect(
      submissionRow.getByText("操作が分かりやすかったです。")
    ).toBeVisible()
  })

  test("設問保存後に集計と提出一覧を再取得し、提出一覧のページ位置を先頭へ戻す", async ({
    page,
  }) => {
    await mockSurveysFlow(page, initialSurveys())
    const summaryRequests: string[] = []
    const submissionOffsets: number[] = []

    page.on("request", (request) => {
      const url = new URL(request.url())
      if (
        request.method() === "GET" &&
        url.pathname.endsWith("/admin/feedback/summary") &&
        url.searchParams.get("surveyId") === "srv_2"
      ) {
        summaryRequests.push(url.toString())
      }
      if (
        request.method() === "GET" &&
        url.pathname.endsWith("/admin/feedback/submissions") &&
        url.searchParams.get("surveyId") === "srv_2"
      ) {
        submissionOffsets.push(Number(url.searchParams.get("offset") ?? 0))
      }
    })

    await page.goto("/admin/surveys/srv_2")
    await expect(page.getByText("1–20 / 25 件")).toBeVisible()
    await expect(page.getByText("respondent1@example.com")).toBeVisible()

    await page.getByRole("button", { name: "次へ" }).click()
    await expect(page.getByText("21–25 / 25 件")).toBeVisible()
    await expect(page.getByText("respondent21@example.com")).toBeVisible()

    await page.getByRole("button", { name: "設問を編集" }).click()
    const question = page.getByLabel("本文")
    await question.fill("保存後に再取得される設問")
    const patchPromise = page.waitForRequest(
      (request) =>
        request.method() === "PATCH" &&
        request.url().includes("/admin/feedback/surveys/srv_2/questions")
    )
    await page.getByRole("button", { name: "設問を保存" }).click()
    const patchRequest = await patchPromise
    expect(patchRequest.postDataJSON()).toEqual({
      questions: [
        {
          type: "text",
          text: "保存後に再取得される設問",
          required: false,
          choices: [],
        },
      ],
    })

    await expect(page.getByText("1–20 / 25 件")).toBeVisible()
    await expect(page.getByText("respondent1@example.com")).toBeVisible()
    expect(summaryRequests.length).toBeGreaterThanOrEqual(2)
    expect(submissionOffsets).toEqual(expect.arrayContaining([0, 20, 0]))
  })
})
