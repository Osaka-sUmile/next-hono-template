import { BaseQueryUseCase } from "./base.query"
import { IUserQueryService, UserQueryResult } from "@workspace/domain"
import type { UserResponseDto } from "../dtos"

/**
 * 全ユーザーを一覧取得する Query ユースケース。
 * admin 向けエンドポイントから呼び出され、クエリサービス経由で取得した結果を DTO に変換して返す。
 */
export class ListUsersUseCase extends BaseQueryUseCase<
  void,
  UserResponseDto[]
> {
  constructor(private readonly userQueryService: IUserQueryService) {
    super()
  }

  /** 全ユーザーを取得し、レスポンス用 DTO の配列として返す。 */
  async execute(): Promise<UserResponseDto[]> {
    const results = await this.userQueryService.findAll()
    return results.map((result) => this.toDto(result))
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
