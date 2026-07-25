import { describe, expect, it } from "vitest";
import { ErrorCodes } from "../presentation";
import { createTestApp } from "../test-utils";

type OpenApiDocument = {
  paths: Record<string, { get?: { security?: unknown }; patch?: { security?: unknown } }>;
  components: {
    schemas: { Error: { properties: { code: { enum: string[] } } } };
    securitySchemes: { cookieAuth: unknown };
  };
};

describe("GET /api-docs/openapi.json", () => {
  it("publishes all v1 routes, error codes, and cookie authentication", async () => {
    const { app } = createTestApp();

    const res = await app.request("/api-docs/openapi.json");
    const document = (await res.json()) as OpenApiDocument;

    expect(res.status).toBe(200);
    expect(document.paths).toMatchObject({
      "/api/v1/health": { get: expect.any(Object) },
      "/api/v1/me": { get: expect.any(Object), patch: expect.any(Object) },
      "/api/v1/admin/users": { get: expect.any(Object) },
    });
    expect(document.components.schemas.Error.properties.code.enum).toEqual(Object.values(ErrorCodes));
    expect(document.components.securitySchemes.cookieAuth).toEqual({
      type: "apiKey",
      in: "cookie",
      name: "better-auth.session_token",
    });
    expect(document.paths["/api/v1/me"]?.get?.security).toEqual([{ cookieAuth: [] }]);
    expect(document.paths["/api/v1/me"]?.patch?.security).toEqual([{ cookieAuth: [] }]);
    expect(document.paths["/api/v1/admin/users"]?.get?.security).toEqual([{ cookieAuth: [] }]);
  });
});
