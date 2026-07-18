import type { Context } from "hono";
import { ListUsersUseCase } from "../../application";
import type { AuthVariables } from "../middleware/require-auth.middleware";

export class AdminController {
  constructor(private readonly listUsersUseCase: ListUsersUseCase) {}

  listUsers = async (c: Context<{ Variables: AuthVariables }>) => {
    const users = await this.listUsersUseCase.execute();
    return c.json(users);
  };
}
