import { BaseEntity, IRepository } from "@workspace/domain";
import { PrismaClient } from "@prisma/client";

export abstract class BasePrismaRepository<
  TEntity extends BaseEntity<TId>,
  TId,
  TPrismaModel,
  TPrismaCreateInput
> implements IRepository<TEntity, TId> {

  constructor(protected readonly prisma: PrismaClient) {}

  protected abstract toDomain(model: TPrismaModel): TEntity;

  // upsert の create: 側でのみ使用する。update: は各サブクラスで個別定義する。
  protected abstract toCreateInput(entity: TEntity): TPrismaCreateInput;

  abstract findById(id: TId): Promise<TEntity | null>;
  abstract save(entity: TEntity): Promise<TEntity>;
  abstract delete(entity: TEntity): Promise<void>;
}
