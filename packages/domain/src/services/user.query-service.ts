import { UserRole } from "../models/user.entity";

export type UserQueryResult = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  displayName: string | null;
  image: string | null;
  emailVerified: boolean;
  createdAt: Date;
};

export interface IUserQueryService {
  findById(id: string): Promise<UserQueryResult | null>;
}
