import type { RouteHandler } from "@hono/zod-openapi"
import { ListUsersUseCase } from "../../application"
import type { AppEnv } from "../app-env"
import type { listUsersRoute } from "../routes"

/** admin 向け API のコントローラ。 */
export class AdminController {
  constructor(private readonly listUsersUseCase: ListUsersUseCase) {}

  /** 全ユーザー一覧を JSON で返す。requireAdmin ミドルウェア通過後にのみ到達する。 */
  listUsers: RouteHandler<typeof listUsersRoute, AppEnv> = async (c) => {
    const users = await this.listUsersUseCase.execute()
    return c.json(users, 200)
  }
}
