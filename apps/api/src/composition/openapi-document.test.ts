import { describe, expect, it } from "vitest"
import { ErrorCodes } from "../presentation"
import { createTestApp } from "../test-utils"

type OpenApiParameter = {
  name: string
  in: string
  description?: string
  schema: Record<string, unknown>
}

type OpenApiOperation = {
  security?: unknown
  parameters?: OpenApiParameter[]
  responses?: Record<string, unknown>
  requestBody?: {
    content?: {
      "application/json"?: {
        schema?: Record<string, unknown>
      }
    }
  }
}

type OpenApiDocument = {
  paths: Record<
    string,
    {
      get?: OpenApiOperation
      delete?: OpenApiOperation
      patch?: OpenApiOperation
      post?: OpenApiOperation
    }
  >
  components: {
    schemas: { Error: { properties: { code: { enum: string[] } } } }
    securitySchemes: { cookieAuth: unknown }
  }
}

describe("GET /api-docs/openapi.json", () => {
  it("publishes all v1 routes, error codes, and cookie authentication", async () => {
    const { app } = createTestApp()

    const res = await app.request("/api-docs/openapi.json")
    const document = (await res.json()) as OpenApiDocument

    expect(res.status).toBe(200)
    expect(document.paths).toMatchObject({
      "/api/v1/health": { get: expect.any(Object) },
      "/api/v1/me": { get: expect.any(Object), patch: expect.any(Object) },
      "/api/v1/admin/summary": { get: expect.any(Object) },
      "/api/v1/admin/users": { get: expect.any(Object) },
      "/api/v1/admin/users/{userId}/role": { patch: expect.any(Object) },
      "/api/v1/feedback/survey": { get: expect.any(Object) },
      "/api/v1/feedback/submissions": { post: expect.any(Object) },
      "/api/v1/admin/feedback/surveys": {
        get: expect.any(Object),
        post: expect.any(Object),
      },
      "/api/v1/admin/feedback/surveys/{surveyId}": {
        delete: expect.any(Object),
        get: expect.any(Object),
        patch: expect.any(Object),
      },
      "/api/v1/admin/feedback/surveys/{surveyId}/questions": {
        patch: expect.any(Object),
      },
      "/api/v1/admin/feedback/surveys/{surveyId}/duplicate": {
        post: expect.any(Object),
      },
      "/api/v1/admin/feedback/submissions": { get: expect.any(Object) },
      "/api/v1/admin/feedback/summary": { get: expect.any(Object) },
    })
    expect(document.components.schemas.Error.properties.code.enum).toEqual(
      Object.values(ErrorCodes)
    )
    expect(document.components.securitySchemes.cookieAuth).toEqual({
      type: "apiKey",
      in: "cookie",
      name: "better-auth.session_token",
    })
    expect(document.paths["/api/v1/me"]?.get?.security).toEqual([
      { cookieAuth: [] },
    ])
    expect(document.paths["/api/v1/me"]?.patch?.security).toEqual([
      { cookieAuth: [] },
    ])
    expect(document.paths["/api/v1/admin/users"]?.get?.security).toEqual([
      { cookieAuth: [] },
    ])
    expect(
      document.paths["/api/v1/admin/users/{userId}/role"]?.patch?.security
    ).toEqual([{ cookieAuth: [] }])
    expect(document.paths["/api/v1/admin/summary"]?.get?.security).toEqual([
      { cookieAuth: [] },
    ])
    expect(document.paths["/api/v1/feedback/survey"]?.get?.security).toEqual([
      { cookieAuth: [] },
    ])
    expect(
      document.paths["/api/v1/feedback/submissions"]?.post?.security
    ).toEqual([{ cookieAuth: [] }])
    expect(
      document.paths["/api/v1/admin/feedback/surveys"]?.get?.security
    ).toEqual([{ cookieAuth: [] }])
    expect(
      document.paths["/api/v1/admin/feedback/surveys"]?.post?.security
    ).toEqual([{ cookieAuth: [] }])
    expect(
      document.paths["/api/v1/admin/feedback/surveys/{surveyId}"]?.get?.security
    ).toEqual([{ cookieAuth: [] }])
    expect(
      document.paths["/api/v1/admin/feedback/surveys/{surveyId}"]?.patch
        ?.security
    ).toEqual([{ cookieAuth: [] }])
    expect(
      document.paths["/api/v1/admin/feedback/submissions"]?.get?.security
    ).toEqual([{ cookieAuth: [] }])
    expect(
      document.paths["/api/v1/admin/feedback/summary"]?.get?.security
    ).toEqual([{ cookieAuth: [] }])
  })

  // z.coerce.number() は null を 0 に変換するため、min(0) だけだと null が検証を通り
  // 生成物に nullable: true が載って apps/web の型が number | null になる。
  // route 側で param.schema を明示している意図が失われないよう契約を固定する。
  it("documents the submission paging params as non-nullable integers", async () => {
    const { app } = createTestApp()

    const res = await app.request("/api-docs/openapi.json")
    const document = (await res.json()) as OpenApiDocument

    const parameters =
      document.paths["/api/v1/admin/feedback/submissions"]?.get?.parameters ??
      []
    const byName = new Map(
      parameters.map((parameter) => [parameter.name, parameter])
    )

    expect(byName.get("limit")?.schema).toMatchObject({
      type: "integer",
      minimum: 1,
      maximum: 100,
    })
    expect(byName.get("offset")?.schema).toMatchObject({
      type: "integer",
      minimum: 0,
    })
    expect(byName.get("limit")?.schema).not.toHaveProperty("nullable")
    expect(byName.get("offset")?.schema).not.toHaveProperty("nullable")
  })

  it("documents the user paging params as non-nullable integers", async () => {
    const { app } = createTestApp()

    const res = await app.request("/api-docs/openapi.json")
    const document = (await res.json()) as OpenApiDocument

    const parameters =
      document.paths["/api/v1/admin/users"]?.get?.parameters ?? []
    const byName = new Map(
      parameters.map((parameter) => [parameter.name, parameter])
    )

    expect(byName.get("limit")?.schema).toMatchObject({
      type: "integer",
      minimum: 1,
      maximum: 100,
    })
    expect(byName.get("offset")?.schema).toMatchObject({
      type: "integer",
      minimum: 0,
    })
    expect(byName.get("limit")?.schema).not.toHaveProperty("nullable")
    expect(byName.get("offset")?.schema).not.toHaveProperty("nullable")
    expect(
      document.paths["/api/v1/admin/users"]?.get?.responses?.["400"]
    ).toMatchObject({
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    })
  })

  it("documents strict write bodies and shared 409 error responses", async () => {
    const { app } = createTestApp()

    const res = await app.request("/api-docs/openapi.json")
    const document = (await res.json()) as OpenApiDocument

    const surveyWriteOperations = [
      document.paths["/api/v1/admin/feedback/surveys"]?.post,
      document.paths["/api/v1/admin/feedback/surveys/{surveyId}"]?.patch,
      document.paths["/api/v1/admin/feedback/surveys/{surveyId}/questions"]
        ?.patch,
      document.paths["/api/v1/admin/feedback/surveys/{surveyId}/duplicate"]
        ?.post,
    ]
    const writeOperations = [
      document.paths["/api/v1/admin/users/{userId}/role"]?.patch,
      ...surveyWriteOperations,
    ]
    for (const operation of writeOperations) {
      expect(
        operation?.requestBody?.content?.["application/json"]?.schema
      ).toMatchObject({ type: "object", additionalProperties: false })
    }

    for (const operation of surveyWriteOperations) {
      expect(operation?.responses?.["409"]).toMatchObject({
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      })
    }

    expect(
      document.paths["/api/v1/admin/feedback/surveys/{surveyId}"]?.delete
        ?.responses?.["204"]
    ).toBeDefined()

    expect(
      document.paths[
        "/api/v1/admin/feedback/surveys/{surveyId}"
      ]?.patch?.parameters?.find((parameter) => parameter.name === "surveyId")
    ).toMatchObject({ description: "Survey to update" })
    expect(
      document.paths["/api/v1/admin/feedback/surveys/{surveyId}"]?.patch
        ?.requestBody?.content?.["application/json"]?.schema
    ).toMatchObject({ minProperties: 1 })
  })
})
