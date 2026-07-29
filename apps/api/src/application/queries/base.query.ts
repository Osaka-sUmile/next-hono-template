/**
 * アプリケーション層（ユースケース基底）
 * CQRSにおける「Query」用のベースクラスです。
 * クエリサービスを利用して、取得したデータを返します。
 */
export abstract class BaseQueryUseCase<TInput, TOutput> {
  abstract execute(input: TInput): Promise<TOutput>
}
