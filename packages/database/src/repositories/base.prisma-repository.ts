import { BaseEntity, IRepository } from "@workspace/domain";
import { PrismaClient } from "@prisma/client";

/**
 * Prismaのモデルとドメインモデル（Entity）の相互変換ルールを定義する
 * BaseとなるPrisma版Repositoryです。
 * 
 * 実際のドメインエンティティ（本番用のモデル等）が完了した後に、
 * このクラスを継承して各実体用のリポジトリを作ります。
 */
export abstract class BasePrismaRepository<
  TEntity extends BaseEntity<TId>,
  TId,
  // Prisma側で生成された型（例えば User, Post など）をGenericsで受け取る
  TPrismaModel,
  // Prisma側で生成されたCreateInputなど、エンティティから永続化する際の型を受け取る
  TPrismaCreateInput
> implements IRepository<TEntity, TId> {
  
  // prismaのクライアントはDIで受け取る
  constructor(protected readonly prisma: PrismaClient) {}

  /**
   * PrismaのDBレコードからドメインエンティティを生成（復元）します
   */
  protected abstract toDomain(model: TPrismaModel): TEntity;

  /**
   * ドメインエンティティからPrisma用のデータ（CreateInputやUpdateInputに相当）に変換します
   */
  protected abstract toPersistence(entity: TEntity): TPrismaCreateInput;

  abstract findById(id: TId): Promise<TEntity | null>;
  abstract save(entity: TEntity): Promise<void>;
  abstract delete(entity: TEntity): Promise<void>;
}

