import { BaseEntity } from "./base.entity";
import { DomainError } from "../errors";

export type UserRole = "user" | "admin";

const USER_ROLES: ReadonlySet<string> = new Set<UserRole>(["user", "admin"]);

export class InvalidUserRoleError extends DomainError {
  constructor(value: string) {
    super(`Invalid UserRole: "${value}"`);
  }
}

export function parseUserRole(value: string): UserRole {
  if (!USER_ROLES.has(value)) throw new InvalidUserRoleError(value);
  return value as UserRole;
}

export class UserEntity extends BaseEntity<string> {
  private constructor(
    id: string,
    readonly email: string,
    readonly name: string,
    readonly role: UserRole,
    readonly displayName: string | null,
  ) {
    super(id);
  }

  static reconstitute(
    id: string,
    email: string,
    name: string,
    role: UserRole,
    displayName: string | null,
  ): UserEntity {
    return new UserEntity(id, email, name, role, displayName);
  }
}
