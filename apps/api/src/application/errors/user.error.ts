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
 * 自分自身を直接降格する単純なロックアウト経路を閉じる。
 * 複数 admin の相互降格が並行した場合まで含む「admin を 0 人にしない」保証には
 * DB トランザクション内の排他制御が必要なため、issue #156 で扱う。
 */
export class CannotChangeOwnRoleError extends ApplicationError {
  constructor(userId: string) {
    super(`A user cannot change their own role: userId="${userId}"`)
  }
}
