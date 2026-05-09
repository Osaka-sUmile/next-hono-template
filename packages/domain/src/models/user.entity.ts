import { BaseEntity } from "./base.entity";

export type UserRole = "user" | "admin";

const USER_ROLES: ReadonlySet<string> = new Set<UserRole>(["user", "admin"]);

export function parseUserRole(value: string): UserRole {
  if (!USER_ROLES.has(value)) throw new Error(`Invalid UserRole: "${value}"`);
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
