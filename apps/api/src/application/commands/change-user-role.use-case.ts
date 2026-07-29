import type { IUserRepository, UserRole } from "@workspace/domain"
import type { UserProfileResponseDto } from "../dtos/user.response.dto"
import {
  CannotChangeOwnRoleError,
  UserNotFoundError,
} from "../errors/user.error"
import { BaseCommandUseCase } from "./base.command"

export type ChangeUserRoleInput = {
  /** 認証済みセッションの user.id。リクエストからは受け取らない。 */
  actorUserId: string
  targetUserId: string
  role: UserRole
}

/** 管理者が別ユーザーの role を変更する Command ユースケース。 */
export class ChangeUserRoleUseCase extends BaseCommandUseCase<
  ChangeUserRoleInput,
  UserProfileResponseDto
> {
  constructor(private readonly userRepository: IUserRepository) {
    super()
  }

  async execute({
    actorUserId,
    targetUserId,
    role,
  }: ChangeUserRoleInput): Promise<UserProfileResponseDto> {
    // role の値にかかわらず、自分自身の role 変更は DB を読む前に決定的に拒否する。
    if (actorUserId === targetUserId) {
      throw new CannotChangeOwnRoleError(actorUserId)
    }

    const user = await this.userRepository.findById(targetUserId)
    if (!user) {
      throw new UserNotFoundError(targetUserId)
    }

    const updated = await this.userRepository.save(user.changeRole(role))
    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      displayName: updated.displayName,
    }
  }
}
