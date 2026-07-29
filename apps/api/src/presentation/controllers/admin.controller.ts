import type { RouteHandler } from "@hono/zod-openapi"
import { GetAdminSummaryUseCase, ListUsersUseCase } from "../../application"
import type { AppEnv } from "../app-env"
import type { getAdminSummaryRoute, listUsersRoute } from "../routes"

/** admin 向け API のコントローラ。 */
export class AdminController {
  constructor(
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly getAdminSummaryUseCase: GetAdminSummaryUseCase
  ) {}

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

  /** 管理ダッシュボード用の KPI を返す。requireAdmin 通過後にのみ到達する。 */
  getSummary: RouteHandler<typeof getAdminSummaryRoute, AppEnv> = async (c) => {
    const result = await this.getAdminSummaryUseCase.execute()
    return c.json(result, 200)
  }
}
