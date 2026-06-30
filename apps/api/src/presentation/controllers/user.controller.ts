import { z } from "zod";
import type { Context } from "hono";
import { GetCurrentUserUseCase } from "../../application";
import type { AuthVariables } from "../middleware/require-auth.middleware";

const getUserMeRequestSchema = z.object({
  auth: z.object({
    user: z.object({
      id: z.string().min(1),
    }),
  }),
});

export class UserController {
  constructor(private readonly getCurrentUserUseCase: GetCurrentUserUseCase) {}

  getUserMe = async (c: Context<{ Variables: AuthVariables }>) => {
    const dto = getUserMeRequestSchema.parse({ auth: c.get("auth") });
    const user = await this.getCurrentUserUseCase.execute({ userId: dto.auth.user.id });
    if (!user) {
      // セッションは有効なのにユーザーが存在しない = データ不整合（想定外）。
      // 自前で 500 を返さず中央エラーハンドラ (onError) に委譲し、ログ・Sentry 送信を一元化する。
      throw new Error(
        `user not found despite valid session (userId=${dto.auth.user.id}) — data inconsistency`,
      );
    }
    return c.json(user);
  };
}
