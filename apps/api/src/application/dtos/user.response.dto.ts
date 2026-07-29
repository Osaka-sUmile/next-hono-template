import type { UserRole } from "@workspace/domain"

export type UserResponseDto = {
  id: string
  email: string
  name: string
  role: UserRole
  displayName: string | null
  image: string | null
  emailVerified: boolean
  createdAt: Date
}

/**
 * Command（書き込み）が返すプロフィール DTO。
 * Query 系（UserResponseDto）と異なり、Command は Repository が復元する UserEntity の
 * フィールドのみを扱う（image / emailVerified / createdAt は認証基盤が管理し Entity は保持しない）。
 */
export type UserProfileResponseDto = {
  id: string
  email: string
  name: string
  role: UserRole
  displayName: string | null
}
