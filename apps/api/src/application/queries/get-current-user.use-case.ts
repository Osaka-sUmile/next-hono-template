import { BaseQueryUseCase } from "./base.query";
import { IUserQueryService } from "@workspace/domain";
import type { UserResponseDto } from "../dtos";

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
