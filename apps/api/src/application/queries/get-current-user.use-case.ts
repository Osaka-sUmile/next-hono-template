import { BaseQueryUseCase } from "./base.query";
import { IUserQueryService, UserQueryResult } from "@workspace/domain";
import type { UserResponseDto } from "../dtos";

export class GetCurrentUserUseCase extends BaseQueryUseCase<
  { userId: string },
  UserResponseDto | null
> {
  constructor(private readonly userQueryService: IUserQueryService) {
    super();
  }

  async execute({ userId }: { userId: string }): Promise<UserResponseDto | null> {
    const result = await this.userQueryService.findById(userId);
    if (!result) return null;
    return this.toDto(result);
  }

  private toDto(result: UserQueryResult): UserResponseDto {
    return {
      id: result.id,
      email: result.email,
      name: result.name,
      role: result.role,
      displayName: result.displayName,
      image: result.image,
      emailVerified: result.emailVerified,
      createdAt: result.createdAt,
    };
  }
}
