import { BaseEntity, IRepository } from "@workspace/domain";
import { PrismaClient } from "@prisma/client";

export abstract class BasePrismaRepository<
  TEntity extends BaseEntity<TId>,
  TId,
  TPrismaModel
> implements IRepository<TEntity, TId> {

  constructor(protected readonly prisma: PrismaClient) {}

  protected abstract toDomain(model: TPrismaModel): TEntity;

  abstract findById(id: TId): Promise<TEntity | null>;
  abstract save(entity: TEntity): Promise<TEntity>;
  abstract delete(entity: TEntity): Promise<void>;
}
