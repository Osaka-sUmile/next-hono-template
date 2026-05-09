import { PrismaClient, Prisma, User as PrismaUser } from "@prisma/client";
import { IUserRepository, UserEntity, parseUserRole } from "@workspace/domain";
import { BasePrismaRepository } from "./base.prisma-repository";

export class UserPrismaRepository
  extends BasePrismaRepository<UserEntity, string, PrismaUser, Prisma.UserCreateInput>
  implements IUserRepository
{
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  protected toDomain(model: PrismaUser): UserEntity {
    return UserEntity.reconstitute(
      model.id,
      model.email,
      model.name,
      parseUserRole(model.role),
      model.displayName,
    );
  }

  protected toCreateInput(entity: UserEntity): Prisma.UserCreateInput {
    return {
      id: entity.id,
      email: entity.email,
      name: entity.name,
      role: entity.role,
      displayName: entity.displayName ?? null,
      emailVerified: false,
    };
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) return null;
    return this.toDomain(user);
  }

  async save(entity: UserEntity): Promise<void> {
    await this.prisma.user.upsert({
      where: { id: entity.id },
      update: {
        name: entity.name,
        role: entity.role,
        displayName: entity.displayName ?? null,
      },
      create: this.toCreateInput(entity),
    });
  }

  async delete(entity: UserEntity): Promise<void> {
    await this.prisma.user.delete({ where: { id: entity.id } });
  }
}
