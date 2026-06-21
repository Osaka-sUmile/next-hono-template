/**
 * 基底リポジトリのインターフェース
 * 永続化技術（Prismaやインメモリ等）に依存しない純粋なTypeScriptインターフェースです。
 * ※ CQRSにおける更新系（Command）での利用を想定しています。
 */
export interface IRepository<TEntity, TId> {
  findById(id: TId): Promise<TEntity | null>;
  save(entity: TEntity): Promise<TEntity>;
  delete(entity: TEntity): Promise<void>;
}
