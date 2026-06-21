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
    try {
      return { ...raw, role: parseUserRole(raw.role) };
    } catch (err) {
      throw new Error(
        `Failed to map user query result (id=${raw.id}, role="${raw.role}"): ${String(err)}`,
      );
    }
  }
}
