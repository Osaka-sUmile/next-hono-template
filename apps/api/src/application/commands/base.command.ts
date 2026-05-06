/**
 * アプリケーション層（ユースケース基底）
 * CQRSにおける「Command」用のベースクラスです。
 * Repository を利用してドメインの操作・保存を行います。
 */
export abstract class BaseCommandUseCase<TInput, TOutput> {
  /**
   * 単一のユースケースを実行します。
   * トランザクション制御等が必要な場合は、デコレータやAOP等で囲むか、
   * ここで一元管理できます。
   */
  abstract execute(input: TInput): Promise<TOutput>;
}
