import { BaseEntity } from "./base.entity";

export type UserRole = "user" | "admin";

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
