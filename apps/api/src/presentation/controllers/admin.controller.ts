import type { Context } from "hono";
import { ListUsersUseCase } from "../../application";
import type { AuthVariables } from "../middleware/require-auth.middleware";

/** admin 向け API のコントローラ。 */
export class AdminController {
  constructor(private readonly listUsersUseCase: ListUsersUseCase) {}

  /** 全ユーザー一覧を JSON で返す。requireAdmin ミドルウェア通過後にのみ到達する。 */
  listUsers = async (c: Context<{ Variables: AuthVariables }>) => {
    const users = await this.listUsersUseCase.execute();
    return c.json(users);
  };
}
