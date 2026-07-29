/**
 * アプリケーション層が意図的に送出するエラーの基底クラス。
 *
 * ユースケースのフロー上で正常に起こり得る失敗を表し、Presentation 層で
 * HTTP エラーへ変換する。DomainRuleViolationError は Application 境界で
 * ユースケース固有の ApplicationError に翻訳し、Presentation へ直接漏らさない。
 */
export abstract class ApplicationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = this.constructor.name
  }
}
