import type { RouteHandler } from "@hono/zod-openapi"
import { ListUsersUseCase } from "../../application"
import type { AppEnv } from "../app-env"
import type { listUsersRoute } from "../routes"

/** admin 向け API のコントローラ。 */
export class AdminController {
  constructor(private readonly listUsersUseCase: ListUsersUseCase) {}

  /** ユーザー検索結果を JSON で返す。requireAdmin ミドルウェア通過後にのみ到達する。 */
  listUsers: RouteHandler<typeof listUsersRoute, AppEnv> = async (c) => {
    const { limit, offset, search, role } = c.req.valid("query")
    const result = await this.listUsersUseCase.execute({
      limit,
      offset,
      ...(search === undefined ? {} : { search }),
      ...(role === undefined ? {} : { role }),
    })
    return c.json(result, 200)
  }
}
