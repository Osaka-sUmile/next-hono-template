import { ApplicationError } from "./application.error"

/** 管理者が指定した userId のユーザーが存在しない。404 USER_NOT_FOUND へ変換する。 */
export class UserNotFoundError extends ApplicationError {
  constructor(userId: string) {
    super(`User not found: userId="${userId}"`)
  }
}

/**
 * 自分自身の role を変更しようとした状態。403 CANNOT_CHANGE_OWN_ROLE へ変換する。
 *
 * このエンドポイントを呼べるのは admin だけなので、admin を 0 人にする唯一の経路は
 * 「最後の admin が自分を降格する」こと。これを禁じればロックアウトが構造的に起こらず
 * count() が不要になる。
 */
export class CannotChangeOwnRoleError extends ApplicationError {
  constructor(userId: string) {
    super(`A user cannot change their own role: userId="${userId}"`)
  }
}
