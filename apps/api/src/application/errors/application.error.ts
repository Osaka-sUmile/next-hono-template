/**
 * アプリケーション層が意図的に送出するエラーの基底クラス。
 *
 * DomainError（`@workspace/domain`）が「ドメインの不変条件違反」を表すのに対し、
 * ApplicationError は「ユースケースのフロー上で起こる想定内の失敗」を表す。
 * どちらも Presentation 層で HTTP エラーへ変換され、500 + Sentry には落とさない。
 */
export abstract class ApplicationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}
