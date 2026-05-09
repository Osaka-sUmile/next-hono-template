import { BaseQueryUseCase } from "./base.query";
import { IUserQueryService, UserRole } from "@workspace/domain";

export type UserResponseDto = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  displayName: string | null;
  image: string | null;
  emailVerified: boolean;
  createdAt: Date;
};

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
