"use client"

import { AdminSurveysTable } from "@/components/admin-surveys-table"

/**
 * アンケート管理ページ。一覧・作成・有効化を提供する。
 */
export default function AdminSurveysPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminSurveysTable />
    </div>
  )
}
