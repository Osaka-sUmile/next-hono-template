import { BaseCommandUseCase } from "./base.command";
import type { IUserRepository } from "@workspace/domain";
import type { UserProfileResponseDto } from "../dtos";

export type UpdateUserProfileInput = {
  userId: string;
  displayName: string | null;
};

/**
 * 自分のプロフィール（表示名）を更新する Command ユースケース（書き込み・副作用あり）。
 *
 * CQRS の Command 側の実装見本。Query 系（GetCurrentUserUseCase 等）が QueryService を使う
 * のに対し、Command は Repository を通してドメインエンティティを取得・変更・保存する。
 *
 * 表示名の長さ等の整合性は UserEntity.changeDisplayName（＝コンストラクタ）で検証される。
 */
export class UpdateUserProfileUseCase extends BaseCommandUseCase<
  UpdateUserProfileInput,
  UserProfileResponseDto
> {
  constructor(private readonly userRepository: IUserRepository) {
    super();
  }

  async execute({ userId, displayName }: UpdateUserProfileInput): Promise<UserProfileResponseDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      // /me 系は認証済みセッションから userId が来るため、ここで見つからないのは
      // データ不整合（想定外）。自前で 4xx を返さず中央エラーハンドラ（onError）へ委譲し、
      // GetCurrentUserUseCase 経由の GET /me と同じ扱い（500 + Sentry）に揃える。
      throw new Error("user not found despite valid session — data inconsistency");
    }

    const updated = await this.userRepository.save(user.changeDisplayName(displayName));

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      displayName: updated.displayName,
    };
  }
}
