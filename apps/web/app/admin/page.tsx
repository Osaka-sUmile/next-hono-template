"use client"

import { AdminKpiCards } from "@/components/admin-kpi-cards"

/**
 * 管理ダッシュボードのトップページ。KPI タイルを表示する。
 */
export default function AdminPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminKpiCards />
    </div>
  )
}
