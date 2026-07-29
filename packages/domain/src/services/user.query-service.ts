import { UserRole } from "../models/user.entity"

export type UserQueryResult = {
  id: string
  email: string
  name: string
  role: UserRole
  displayName: string | null
  image: string | null
  emailVerified: boolean
  createdAt: Date
}

export type UserSearchParams = {
  limit: number
  offset: number
  search?: string
  role?: UserRole
}

export type UserSearchResult = {
  items: UserQueryResult[]
  total: number
}

export interface IUserQueryService {
  findById(id: string): Promise<UserQueryResult | null>
  /** 管理者向けにユーザーを検索し、ページングした結果と一致件数を返す。 */
  search(params: UserSearchParams): Promise<UserSearchResult>
}
