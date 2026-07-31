import { BaseEntity } from "./base.entity"
import { DomainError, InvalidArgumentError } from "../errors"

export type UserRole = "user" | "admin"

const USER_ROLES: ReadonlySet<string> = new Set<UserRole>(["user", "admin"])

export class InvalidUserRoleError extends DomainError {
  constructor(value: string) {
    super(`Invalid UserRole: "${value}"`)
  }
}

export function parseUserRole(value: string): UserRole {
  if (!USER_ROLES.has(value)) throw new InvalidUserRoleError(value)
  return value as UserRole
}

const DISPLAY_NAME_MAX_LENGTH = 100

/** 線形時間の簡易チェック（ReDoS を避ける。厳密な RFC 検証は Presentation 層の Zod に委ねる）。 */
function isValidEmailFormat(email: string): boolean {
  const at = email.indexOf("@")
  if (at <= 0 || at === email.length - 1) return false
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  if (local.length === 0 || domain.length === 0) return false
  if (local.includes(" ") || domain.includes(" ")) return false
  const dot = domain.indexOf(".")
  if (dot <= 0 || dot === domain.length - 1) return false
  return true
}

export class UserEntity extends BaseEntity<string> {
  private constructor(
    id: string,
    readonly email: string,
    readonly name: string,
    readonly role: UserRole,
    readonly displayName: string | null
  ) {
    super(id)
    if (!isValidEmailFormat(email))
      throw new InvalidArgumentError(`Invalid email format: "${email}"`)
    if (displayName !== null && displayName.length > DISPLAY_NAME_MAX_LENGTH) {
      throw new InvalidArgumentError(
        `displayName must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer`
      )
    }
  }

  static reconstitute(
    id: string,
    email: string,
    name: string,
    role: UserRole,
    displayName: string | null
  ): UserEntity {
    return new UserEntity(id, email, name, role, displayName)
  }

  /**
   * 表示名を変更した新しい UserEntity を返す（このインスタンスは変更しない）。
   * Entity は不変（すべて readonly）に保つため、更新はコピーを返す形で表現する。
   * 長さ等の整合性チェックはコンストラクタに集約されているため、new を通すことで自動的に検証される。
   */
  changeDisplayName(displayName: string | null): UserEntity {
    return new UserEntity(
      this.id,
      this.email,
      this.name,
      this.role,
      displayName
    )
  }

  /**
   * ロールを変更した新しい UserEntity を返す（このインスタンスは変更しない）。
   * 「admin を 0 人にしない」等の運用上の制約は Domain では表現できない（他ユーザーの状態が必要）ため、
   * Application 層（自己降格の禁止）で担保する。
   */
  changeRole(role: UserRole): UserEntity {
    return new UserEntity(
      this.id,
      this.email,
      this.name,
      role,
      this.displayName
    )
  }
}
