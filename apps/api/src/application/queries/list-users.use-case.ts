import { BaseQueryUseCase } from "./base.query"
import { IUserQueryService, UserQueryResult } from "@workspace/domain"
import type { UserListResponseDto, UserResponseDto } from "../dtos"

export type ListUsersInput = {
  limit: number
  offset: number
  search?: string
  role?: "user" | "admin"
}

/**
 * 全ユーザーを一覧取得する Query ユースケース。
 * admin 向けエンドポイントから呼び出され、クエリサービス経由で取得した結果を DTO に変換して返す。
 */
export class ListUsersUseCase extends BaseQueryUseCase<
  ListUsersInput,
  UserListResponseDto
> {
  constructor(private readonly userQueryService: IUserQueryService) {
    super()
  }

  async execute({
    limit,
    offset,
    search,
    role,
  }: ListUsersInput): Promise<UserListResponseDto> {
    const { items, total } = await this.userQueryService.search({
      limit,
      offset,
      ...(search === undefined ? {} : { search }),
      ...(role === undefined ? {} : { role }),
    })
    return {
      items: items.map((result) => this.toDto(result)),
      total,
      limit,
      offset,
    }
  }

  /** UserQueryResult を API レスポンス用 DTO に変換する。 */
  private toDto(result: UserQueryResult): UserResponseDto {
    return {
      id: result.id,
      email: result.email,
      name: result.name,
      role: result.role,
      displayName: result.displayName,
      image: result.image,
      emailVerified: result.emailVerified,
      createdAt: result.createdAt,
    }
  }
}
