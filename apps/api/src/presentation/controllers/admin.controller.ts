import type { RouteHandler } from "@hono/zod-openapi"
import {
  CannotChangeOwnRoleError,
  type ChangeUserRoleUseCase,
  GetAdminSummaryUseCase,
  ListUsersUseCase,
  UserNotFoundError,
} from "../../application"
import type { AppEnv } from "../app-env"
import { ErrorCodes } from "../errors"
import { errorResponse } from "../http"
import type {
  changeUserRoleRoute,
  getAdminSummaryRoute,
  listUsersRoute,
} from "../routes"

/** admin 向け API のコントローラ。 */
export class AdminController {
  constructor(
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly getAdminSummaryUseCase: GetAdminSummaryUseCase,
    private readonly changeUserRoleUseCase: ChangeUserRoleUseCase
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

  /** 認証中の admin 自身ではなく、パスで指定したユーザーの role を変更する。 */
  changeUserRole: RouteHandler<typeof changeUserRoleRoute, AppEnv> = async (
    c
  ) => {
    const { user } = c.get("auth")
    const { userId } = c.req.valid("param")
    const { role } = c.req.valid("json")

    try {
      const result = await this.changeUserRoleUseCase.execute({
        actorUserId: user.id,
        targetUserId: userId,
        role,
      })
      return c.json(result, 200)
    } catch (error) {
      if (error instanceof CannotChangeOwnRoleError) {
        return errorResponse(
          c,
          403,
          ErrorCodes.CANNOT_CHANGE_OWN_ROLE,
          error.message
        )
      }
      if (error instanceof UserNotFoundError) {
        return errorResponse(c, 404, ErrorCodes.USER_NOT_FOUND, error.message)
      }
      throw error
    }
  }
}
