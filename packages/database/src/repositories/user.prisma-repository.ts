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
    try {
      return UserEntity.reconstitute(
        model.id,
        model.email,
        model.name,
        parseUserRole(model.role),
        model.displayName,
      );
    } catch (err) {
      throw new Error(`Failed to reconstitute UserEntity (id=${model.id}, role="${model.role}"): ${String(err)}`);
    }
  }

  protected toCreateInput(entity: UserEntity): Prisma.UserCreateInput {
    return {
      id: entity.id,
      email: entity.email,
      name: entity.name,
      role: entity.role,
      displayName: entity.displayName ?? null,
      // UserEntity は emailVerified を持たない。better-auth が認証フロー完了後に true へ更新するため、
      // create 側は false 固定で問題ない（update 側も emailVerified を触らない設計）。
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
        // emailVerified は認証時に別途更新されるため、ここではアプリケーション側の更新を受けない
      },
      create: this.toCreateInput(entity),
    });
  }

  async delete(entity: UserEntity): Promise<void> {
    await this.prisma.user.delete({ where: { id: entity.id } });
  }
}
