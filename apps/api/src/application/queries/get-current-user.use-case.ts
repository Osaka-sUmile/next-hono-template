import { BaseQueryUseCase } from "./base.query";
import { IUserQueryService, UserQueryResult } from "@workspace/domain";

export type UserResponseDto = UserQueryResult;

export class GetCurrentUserUseCase extends BaseQueryUseCase<
  { userId: string },
  UserResponseDto | null
> {
  constructor(private readonly userQueryService: IUserQueryService) {
    super();
  }

  async execute({ userId }: { userId: string }): Promise<UserResponseDto | null> {
    return this.userQueryService.findById(userId);
  }
}
