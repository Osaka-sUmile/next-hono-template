import { ErrorSchema } from "./error.schema"

type ErrorStatus = 400 | 401 | 403 | 404 | 429 | 500

/** Generate typed OpenAPI response definitions for the shared error contract. */
export function errorResponses<
  const M extends Partial<Record<ErrorStatus, string>>,
>(
  map: M
): {
  [K in keyof M]: {
    description: M[K]
    content: { "application/json": { schema: typeof ErrorSchema } }
  }
} {
  return Object.fromEntries(
    Object.entries(map).map(([status, description]) => [
      status,
      { description, content: { "application/json": { schema: ErrorSchema } } },
    ])
  ) as never
}
