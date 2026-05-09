import { PrismaClient } from "@prisma/client";
import { IUserQueryService, UserQueryResult, parseUserRole } from "@workspace/domain";

export class UserQueryService implements IUserQueryService {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<UserQueryResult | null> {
    const raw = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        displayName: true,
        image: true,
        emailVerified: true,
        createdAt: true,
      },
    });
    if (!raw) return null;
    return { ...raw, role: parseUserRole(raw.role) };
  }
}
