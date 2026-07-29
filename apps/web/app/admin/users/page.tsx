"use client"

import { AdminUsersTable } from "@/components/admin-users-table"

/**
 * ユーザー管理ページ。一覧・検索・ロールフィルタ・ロール変更を提供する。
 */
export default function AdminUsersPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminUsersTable />
    </div>
  )
}
