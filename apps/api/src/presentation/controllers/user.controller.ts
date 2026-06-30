import { z } from "zod";
import { Response } from "express";
import { GetCurrentUserUseCase } from "../../application";
import { AuthenticatedRequest } from "../middleware/require-auth.middleware";

const getUserMeRequestSchema = z.object({
  auth: z.object({
    user: z.object({
      id: z.string().min(1),
    }),
  }),
});

export class UserController {
  constructor(private readonly getCurrentUserUseCase: GetCurrentUserUseCase) {}

  getUserMe = async (req: AuthenticatedRequest, res: Response) => {
    const dto = getUserMeRequestSchema.parse({ auth: req.auth });
    const user = await this.getCurrentUserUseCase.execute({ userId: dto.auth.user.id });
    if (!user) {
      // セッションは有効なのにユーザーが存在しない = データ不整合（想定外）。
      // 自前で 500 を返さず中央エラーハンドラに委譲し、ログ・Sentry 送信を一元化する。
      throw new Error(
        `user not found despite valid session (userId=${dto.auth.user.id}) — data inconsistency`,
      );
    }
    res.json(user);
    // 想定外エラーはここで握りつぶさず、withAuth の .catch(next) 経由で中央ハンドラへ伝播させる。
  };
}
