/**
 * ドメイン層のすべてのエンティティの基底クラス。
 * 識別子（ID）や、共通の振る舞いを持ちます。
 */
export abstract class BaseEntity<TId> {
  protected constructor(protected readonly _id: TId) {}

  get id(): TId {
    return this._id;
  }

  // エンティティの同一性はIDによって判定されます
  public equals(other?: BaseEntity<TId>): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    if (this === other) {
      return true;
    }
    // IDがValue Objectなどであり、equalsメソッドを持つ場合はそちらを優先する
    if (hasEquals(this._id)) {
      return this._id.equals(other._id);
    }
    return this._id === other._id;
  }

  /**
   * ドメインの不変条件チェック用フック。
   * 派生クラスは生成時や更新時に必要な条件をここで検証できます。
   */
  protected validate(): void {}

  /**
   * 不変条件を満たさない場合に例外を投げるヘルパ。
   */
  protected ensure(condition: unknown, error: Error): asserts condition {
    if (!condition) {
      throw error;
    }
  }
}

type Equatable<T> = {
  equals(other: T): boolean;
};

function hasEquals<T>(value: T): value is T & Equatable<T> {
  return value !== null && value !== undefined && typeof value === "object" && "equals" in value && typeof (value as Record<string, unknown>).equals === "function";
}
