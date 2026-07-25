import { z } from "zod";
import type { RouteHandler } from "@hono/zod-openapi";
import { GetCurrentUserUseCase, UpdateUserProfileUseCase } from "../../application";
import type { AppEnv } from "../app-env";
import type { getUserMeRoute, updateUserMeRoute } from "../routes";

const getUserMeRequestSchema = z.object({
  auth: z.object({
    user: z.object({
      id: z.string().min(1),
    }),
  }),
});

export class UserController {
  constructor(
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
    private readonly updateUserProfileUseCase: UpdateUserProfileUseCase,
  ) {}

  getUserMe: RouteHandler<typeof getUserMeRoute, AppEnv> = async (c) => {
    const dto = getUserMeRequestSchema.parse({ auth: c.get("auth") });
    const user = await this.getCurrentUserUseCase.execute({ userId: dto.auth.user.id });
    if (!user) {
      // セッションは有効なのにユーザーが存在しない = データ不整合（想定外）。
      // 自前で 500 を返さず中央エラーハンドラ (onError) に委譲し、ログ・Sentry 送信を一元化する。
      throw new Error(
        `user not found despite valid session (userId=${dto.auth.user.id}) — data inconsistency`,
      );
    }
    return c.json(user, 200);
  };

  // PATCH /me: 認証済みユーザーが自分の表示名を更新する（Command 側の実装見本）。
  updateUserMe: RouteHandler<typeof updateUserMeRoute, AppEnv> = async (c) => {
    const { auth } = getUserMeRequestSchema.parse({ auth: c.get("auth") });
    const { displayName } = c.req.valid("json");
    const updated = await this.updateUserProfileUseCase.execute({
      userId: auth.user.id,
      displayName,
    });
    return c.json(updated, 200);
  };
}
