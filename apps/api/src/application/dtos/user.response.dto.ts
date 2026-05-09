import type { UserRole } from "@workspace/domain";

export type UserResponseDto = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  displayName: string | null;
  image: string | null;
  emailVerified: boolean;
  createdAt: Date;
};
