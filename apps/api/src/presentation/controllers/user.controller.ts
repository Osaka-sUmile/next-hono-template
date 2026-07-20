import { z } from "zod";
import type { Context } from "hono";
import { GetCurrentUserUseCase, UpdateUserProfileUseCase } from "../../application";
import { readJsonBody } from "../http";
import type { AuthVariables } from "../middleware/require-auth.middleware";

const getUserMeRequestSchema = z.object({
  auth: z.object({
    user: z.object({
      id: z.string().min(1),
    }),
  }),
});

const DISPLAY_NAME_MAX_LENGTH = 100;

// 表示名の更新リクエストボディ。空文字は「表示名なし」を意味する null に正規化する。
const updateUserMeBodySchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(DISPLAY_NAME_MAX_LENGTH)
    .nullable()
    .transform((value) => (value === "" ? null : value)),
});

export class UserController {
  constructor(
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
    private readonly updateUserProfileUseCase: UpdateUserProfileUseCase,
  ) {}

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

  // PATCH /me: 認証済みユーザーが自分の表示名を更新する（Command 側の実装見本）。
  updateUserMe = async (c: Context<{ Variables: AuthVariables }>) => {
    const { auth } = getUserMeRequestSchema.parse({ auth: c.get("auth") });
    // 入力（Presentation 境界）は Zod で検証する。JSON パース失敗は InvalidJsonBodyError、
    // スキーマ不一致は ZodError として throw され、onError で 400 VALIDATION_ERROR に写像される。
    const body = updateUserMeBodySchema.parse(await readJsonBody(c));
    const updated = await this.updateUserProfileUseCase.execute({
      userId: auth.user.id,
      displayName: body.displayName,
    });
    return c.json(updated);
  };
}
