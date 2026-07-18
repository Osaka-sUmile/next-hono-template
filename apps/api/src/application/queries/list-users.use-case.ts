import { BaseQueryUseCase } from "./base.query";
import { IUserQueryService, UserQueryResult } from "@workspace/domain";
import type { UserResponseDto } from "../dtos";

export class ListUsersUseCase extends BaseQueryUseCase<void, UserResponseDto[]> {
  constructor(private readonly userQueryService: IUserQueryService) {
    super();
  }

  async execute(): Promise<UserResponseDto[]> {
    const results = await this.userQueryService.findAll();
    return results.map((result) => this.toDto(result));
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
