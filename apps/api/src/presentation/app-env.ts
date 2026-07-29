import type { WorkerRateLimitBindings } from "../infrastructure"
import type { AuthVariables } from "./middleware/require-auth.middleware"

/** Context variables shared by the API application and its OpenAPI route handlers. */
export type AppEnv = {
  Bindings: WorkerRateLimitBindings
  Variables: AuthVariables
}
